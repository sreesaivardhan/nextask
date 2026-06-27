import { PrismaClient } from '@prisma/client';
import { cardRepository } from '../repositories/card.repository';
import { boardMemberRepository } from '../repositories/boardMember.repository';
import { activityLogService } from './activityLog.service';
import { columnRepository } from '../repositories/column.repository';
import { getIO } from '../socket';
import { authzService } from './authorization.service';
import { env } from '../config/env';
import { inferCardComplexity, invalidateBoardInsights } from './ai.service';

const prisma = new PrismaClient();

interface GithubIssue {
  id: number;
  number: number;
  title: string;
  body: string | null;
  html_url: string;
  created_at: string;
  labels: { name: string; color: string }[];
  assignee: { login: string; avatar_url: string } | null;
  assignees: { login: string; avatar_url: string }[];
  milestone: { title: string } | null;
  pull_request?: Record<string, unknown>;
}

export class GithubService {
  private parseGithubUrl(url: string): { owner: string; repo: string } {
    try {
      const parsed = new URL(url);
      if (parsed.hostname !== 'github.com') throw new Error('Not a GitHub URL');
      const parts = parsed.pathname.split('/').filter(Boolean);
      if (parts.length < 2) throw new Error('Invalid repository URL format');
      return { owner: parts[0], repo: parts[1] };
    } catch {
      throw new Error('Invalid repository URL.');
    }
  }

  private async getRepoDetails(owner: string, repo: string): Promise<{ open_issues_count?: number }> {
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'NexTask-Importer'
    };
    if (env.githubToken) {
      headers['Authorization'] = `Bearer ${env.githubToken}`;
    }
    let res;
    try {
      res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
    } catch {
      throw new Error('Unable to contact GitHub.');
    }
    if (!res.ok) {
      if (res.status === 404) throw new Error('Repository not found or is private.');
      if (res.status === 401) throw new Error('GitHub authentication failed.');
      if (res.status === 403) {
        if (res.headers.get('x-ratelimit-remaining') === '0') throw new Error('GitHub API rate limit exceeded.');
        throw new Error('GitHub API forbidden.');
      }
      throw new Error(`Unexpected server error: ${res.statusText}`);
    }
    return res.json() as Promise<{ open_issues_count?: number }>;
  }

  private async prepareImport(boardId: string, owner: string, repo: string): Promise<{
    repo: string;
    totalOpenIssues: number;
    importLimit: number;
    eligibleIssues: GithubIssue[];
    skippedExisting: number;
    pullRequestsIgnored: number;
  }> {
    const repoFullName = `${owner}/${repo}`;
    const repoDetails = await this.getRepoDetails(owner, repo);
    const totalOpenIssues = repoDetails.open_issues_count || 0;

    let nextUrl: string | null = `https://api.github.com/repos/${owner}/${repo}/issues?state=open&per_page=100`;

    let pullRequestsIgnored = 0;
    let skippedExisting = 0;
    const importableIssues: GithubIssue[] = [];
    const IMPORT_LIMIT = 20;

    while (nextUrl && importableIssues.length < IMPORT_LIMIT) {
      const headers: Record<string, string> = {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'NexTask-Importer'
      };
      if (env.githubToken) {
        headers['Authorization'] = `Bearer ${env.githubToken}`;
      }

      let res;
      try {
        res = await fetch(nextUrl, { headers });
      } catch {
        throw new Error('Unable to contact GitHub.');
      }

      if (!res.ok) {
        if (res.status === 404) throw new Error('Repository not found or is private.');
        if (res.status === 401) throw new Error('GitHub authentication failed.');
        if (res.status === 403) {
          if (res.headers.get('x-ratelimit-remaining') === '0') {
            throw new Error('GitHub API rate limit exceeded.');
          }
          throw new Error('GitHub API forbidden.');
        }
        if (res.status === 422) throw new Error('Repository request malformed.');
        throw new Error(`Unexpected server error: ${res.statusText}`);
      }

      const data = (await res.json()) as GithubIssue[];
      if (data.length === 0) break;

      const linkHeader = res.headers.get('link');
      nextUrl = null;
      if (linkHeader) {
        const nextLink = linkHeader.split(',').find(l => l.includes('rel="next"'));
        if (nextLink) {
          const match = nextLink.match(/<([^>]+)>/);
          if (match) nextUrl = match[1];
        }
      }

      const issueNumbersInPage = data.map(i => i.number);
      const existingCardsInPage = await prisma.card.findMany({
        where: { boardId, githubRepo: repoFullName, githubIssueNumber: { in: issueNumbersInPage } },
        select: { githubIssueNumber: true }
      });
      const existingNumbers = new Set(existingCardsInPage.map(c => c.githubIssueNumber));

      for (const issue of data) {
        if (importableIssues.length >= IMPORT_LIMIT) break;

        if (issue.pull_request) {
          pullRequestsIgnored++;
          continue;
        }

        if (existingNumbers.has(issue.number)) {
          skippedExisting++;
          continue;
        }

        importableIssues.push(issue);
      }
    }

    return {
      repo: repoFullName,
      totalOpenIssues,
      importLimit: IMPORT_LIMIT,
      eligibleIssues: importableIssues,
      skippedExisting,
      pullRequestsIgnored
    };
  }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  async previewImport(boardId: string, url: string, userId: string) {
    await authzService.requireBoardRole(boardId, userId, ['OWNER', 'ADMIN']);

    const { owner, repo } = this.parseGithubUrl(url);
    const summary = await this.prepareImport(boardId, owner, repo);

    return {
      repo: summary.repo,
      totalOpenIssues: summary.totalOpenIssues,
      importLimit: summary.importLimit,
      skippedCount: summary.skippedExisting,
      pullRequestsIgnored: summary.pullRequestsIgnored,
      importableCount: summary.eligibleIssues.length,
      sampleIssues: summary.eligibleIssues.slice(0, 10).map(i => ({
        number: i.number,
        title: i.title,
        labels: i.labels.map(l => ({ name: l.name, color: l.color })),
        assignee: i.assignees.length > 0 ? i.assignees[0].login : null,
        milestone: i.milestone?.title || null,
        createdAt: i.created_at
      }))
    };
  }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  async executeImport(boardId: string, url: string, userId: string) {
    await authzService.requireBoardRole(boardId, userId, ['OWNER', 'ADMIN']);

    const { owner, repo } = this.parseGithubUrl(url);
    const summary = await this.prepareImport(boardId, owner, repo);
    const repoFullName = summary.repo;
    
    const issuesToImport = summary.eligibleIssues;
    if (issuesToImport.length === 0) {
      return { importedCount: 0, skippedCount: summary.skippedExisting, pullRequestsIgnored: summary.pullRequestsIgnored };
    }

    // Get board members for assignee matching
    const members = await boardMemberRepository.findMembersByBoardId(boardId);
    const userIds = members.map(m => m.userId);
    const users = await prisma.user.findMany({ where: { id: { in: userIds } } });

    // Create a map of login names to user IDs (very naive matching by display name or email prefix)
    const githubToUserId = new Map<string, string>();
    for (const u of users) {
      if (u.email) {
        const emailPrefix = u.email.split('@')[0].toLowerCase();
        githubToUserId.set(emailPrefix, u.id);
      }
      const displayNameLower = u.displayName.toLowerCase();
      githubToUserId.set(displayNameLower, u.id);
    }

    // Find the first column to put issues in
    const columns = await columnRepository.findAllByBoardId(boardId);
    if (columns.length === 0) throw new Error('Board has no columns to import to');
    const targetColumnId = columns[0].id;

    let currentMaxPos = await cardRepository.getMaxPosition(targetColumnId);

    // Process imports
    // Wrap in a transaction to ensure atomic batch creation where possible
    // Wait, CardLabel creation needs to be done carefully. Let's do it sequentially but optimized,
    // since we need to create ActivityLog and emit socket events.

    let importedCount = 0;

    // Fetch all existing labels for the board
    const existingLabels = await prisma.label.findMany({ where: { boardId } });
    const labelNameToId = new Map(existingLabels.map(l => [l.name.toLowerCase(), l.id]));

    const createdCards = [];

    for (const issue of issuesToImport) {
      currentMaxPos += 65535;

      let assigneeId: string | null = null;
      if (issue.assignees.length > 0) {
        const login = issue.assignees[0].login.toLowerCase();
        assigneeId = githubToUserId.get(login) || null;
      }

      let description = issue.body || '';
      if (issue.milestone) {
        description += `\n\n**Milestone:** ${issue.milestone.title}`;
      }
      description += `\n\n**Original Issue:** [${repoFullName}#${issue.number}](${issue.html_url})`;

      // Create card
      const newCard = await prisma.card.create({
        data: {
          boardId,
          columnId: targetColumnId,
          title: issue.title,
          description: description,
          position: currentMaxPos,
          githubRepo: repoFullName,
          githubIssueNumber: issue.number,
          assigneeId: assigneeId
        }
      });

      // Process labels
      if (issue.labels.length > 0) {
        const cardLabelsToCreate = [];
        for (const ghLabel of issue.labels) {
          const lowerName = ghLabel.name.toLowerCase();
          let labelId = labelNameToId.get(lowerName);
          if (!labelId) {
            // Create new label
            const newLabel = await prisma.label.create({
              data: {
                boardId,
                name: ghLabel.name,
                color: ghLabel.color ? `#${ghLabel.color}` : '#cccccc'
              }
            });
            labelId = newLabel.id;
            labelNameToId.set(lowerName, labelId);
          }
          cardLabelsToCreate.push({ cardId: newCard.id, labelId });
        }

        if (cardLabelsToCreate.length > 0) {
          await prisma.cardLabel.createMany({ data: cardLabelsToCreate });
        }
      }

      // Create ActivityLog
      await activityLogService.log(boardId, userId, 'CARD_CREATED', 'Card', newCard.id, {
        title: newCard.title,
        githubRepo: repoFullName,
        githubIssue: issue.number,
        githubUrl: issue.html_url
      });

      importedCount++;
      createdCards.push(newCard);
    }

    // Fetch full card data for the socket emission
    const fullCreatedCards = await prisma.card.findMany({
      where: { id: { in: createdCards.map(c => c.id) } },
      include: {
        labels: { include: { label: true } },
        assignee: true,
        lastEditedBy: true,
      }
    });

    // Emit socket events
    const io = getIO();
    if (io) {
      for (const card of fullCreatedCards) {
        io.to(boardId).emit('card:created', card);
      }
    }

    // Execute AI analyses
    for (const card of createdCards) {
      inferCardComplexity(card.id).catch(err => console.error('[AI] Complexity Error:', err.message));
    }
    invalidateBoardInsights(boardId).catch(err => console.error('[AI] Insights Error:', err.message));

    return { 
      importedCount, 
      skippedCount: summary.skippedExisting,
      pullRequestsIgnored: summary.pullRequestsIgnored
    };
  }
}

export const githubService = new GithubService();
