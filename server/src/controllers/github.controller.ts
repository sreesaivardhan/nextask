import { Request, Response, NextFunction } from 'express';
import { githubService } from '../services/github.service';

export class GithubController {
  async previewImport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { boardId } = req.params;
      const { url } = req.body;
      
      if (!url) {
        res.status(400).json({ error: 'GitHub repository URL is required' });
        return;
      }
      
      const preview = await githubService.previewImport(boardId, url, userId);
      res.status(200).json(preview);
    } catch (error) {
      if (error instanceof Error) {
        const msg = error.message;
        if (msg.includes('Invalid repository URL')) {
          res.status(400).json({ error: msg });
          return;
        }
        if (msg.includes('authentication failed')) {
          res.status(401).json({ error: msg });
          return;
        }
        if (msg.includes('forbidden') || msg.includes('rate limit exceeded')) {
          res.status(403).json({ error: msg });
          return;
        }
        if (msg.includes('not found') || msg.includes('private')) {
          res.status(404).json({ error: msg });
          return;
        }
        if (msg.includes('malformed')) {
          res.status(422).json({ error: msg });
          return;
        }
        if (msg.includes('contact GitHub') || msg.includes('Unexpected')) {
          res.status(500).json({ error: msg });
          return;
        }
        if (msg.includes('Unauthorized')) {
          res.status(403).json({ error: msg });
          return;
        }
      }
      next(error);
    }
  }

  async executeImport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { boardId } = req.params;
      const { url } = req.body;
      
      if (!url) {
        res.status(400).json({ error: 'GitHub repository URL is required' });
        return;
      }
      
      const result = await githubService.executeImport(boardId, url, userId);
      res.status(200).json(result);
    } catch (error) {
      if (error instanceof Error) {
        const msg = error.message;
        if (msg.includes('Invalid repository URL') || msg.includes('no columns')) {
          res.status(400).json({ error: msg });
          return;
        }
        if (msg.includes('authentication failed')) {
          res.status(401).json({ error: msg });
          return;
        }
        if (msg.includes('forbidden') || msg.includes('rate limit exceeded')) {
          res.status(403).json({ error: msg });
          return;
        }
        if (msg.includes('not found') || msg.includes('private')) {
          res.status(404).json({ error: msg });
          return;
        }
        if (msg.includes('malformed')) {
          res.status(422).json({ error: msg });
          return;
        }
        if (msg.includes('contact GitHub') || msg.includes('Unexpected')) {
          res.status(500).json({ error: msg });
          return;
        }
        if (msg.includes('Unauthorized')) {
          res.status(403).json({ error: msg });
          return;
        }
      }
      next(error);
    }
  }
}

export const githubController = new GithubController();
