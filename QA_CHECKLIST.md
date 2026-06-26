# NexTask QA Checklist (Sprint 1 + Sprint 2)

## Environment

* [*] PostgreSQL running
* [*] Prisma migration successful
* [*] Backend starts
* [*] Frontend starts
* [*] `/health` returns 200
* [*] No console errors
* [*] No build errors
* [*] No lint errors

---

# Session Testing

### Login

* [*] Login page appears for first visit
* [*] Empty display name rejected
* [*] Spaces only rejected
* [nope] Very long name rejected
* [*] Valid name accepted

### Persistence

* [*] Refresh keeps session
* [*] Browser restart keeps session (if expected by implementation)
* [*] Logout removes session
* [*] Logout redirects to login

### Session Isolation

Open Chrome and Edge.

* [*] Chrome login works
* [*] Edge login works
* [*] Same display name creates separate identities
* [*] Different display names work
* [*] Cookies remain independent

---

# Dashboard

* [*] Dashboard loads
* [*] Empty state displays correctly
* [*] Header renders
* [*] Responsive layout works

---

# Board CRUD

### Create

* [*] Create board
* [*] Empty name rejected
* [*] Whitespace trimmed
* [nope] 100+ chars rejected
* [*] Board appears immediately
* [*] Refresh keeps board

### Rename

* [*] Rename works
* [*] Validation works
* [*] Refresh persists rename

### Delete

* [*] Confirmation dialog appears
* [*] Cancel works
* [*] Delete works
* [*] Refresh confirms deletion

---

# Board Navigation

* [*] Open board
* [*] Correct board loads
* [*] URL updates
* [*] Refresh keeps correct board

---

# Column CRUD

### Create

* [*] Add column
* [*] Empty rejected
* [*] Validation works
* [*] Appears at end

### Rename

* [*] Rename persists

### Delete

* [*] Confirmation dialog
* [*] Cancel works
* [*] Delete works

### Reorder

* [*] Move left
* [*] Move right
* [*] Position persists after refresh

---

# Card CRUD

### Create

* [*] Add card
* [*] Empty title rejected
* [nope] 200+ chars rejected
* [*] Appears in correct column
* [*] Refresh persists

### Edit

* [ ] Edit title
* [ ] Edit description
* [ ] Edit assignee
* [ ] Edit complexity
* [ ] Save persists

### Delete

* [*] Delete confirmation
* [*] Cancel works
* [*] Delete works
* [*] Refresh confirms deletion

---

# Card Movement
unable to move any cards
* [nope] Move within column
* [nope] Move to another column
* [nope] Position correct
* [nope] Refresh persists

---

# Comments

### Create

* [*] Add comment
* [*] Empty rejected
* [*] Validation works

### View

* [*] Comments ordered correctly
* [*] Author shown
* [*] Timestamp shown

### Delete

* [*] Delete works
* [*] Refresh confirms deletion

---

# Activity History

Verify entries exist for:

* [*] Card created
* [*] Card edited
* [nope] Card moved
* [*] Comment added
* [*] Complexity changed
* [*] Assignment changed
* [*] Card deleted

Verify:

* [*] Correct user
* [*] Correct timestamp
* [*] Correct ordering

---

# Versioning

Open same card in two browser windows. : not working as expected unable to open same card in two browser windows

Window A

* [ ] Edit
* [ ] Save

Window B

* [ ] Edit stale version
* [ ] Save rejected

Verify

* [*] HTTP 409 returned
* [*] User-friendly error shown
* [*] No data overwritten

---

# Validation

Verify every form:

* [*] Required fields
* [nope] Max lengths
* [*] Invalid complexity rejected
* [recheck needed] Invalid requests handled gracefully

---

# Database Persistence

Restart backend. : help me do this

* [ ] Boards remain
* [ ] Columns remain
* [ ] Cards remain
* [ ] Comments remain
* [ ] Activity history remains

---

# UX

* [*] No browser alerts
* [*] No browser confirms
* [*] No prompts
* [*] Toasts work
* [*] Modals work
* [*] Loading states reasonable

---

# Developer Console

* [*] No React warnings
* [*] No TypeScript runtime errors
* [*] No failed API requests
* [*] No unhandled promise rejections

---

# Network Tab

Verify

* [*] Correct REST endpoints called
* [*] No duplicate requests
* [*] Correct HTTP status codes
* [*] Cookies sent correctly

---

# Final

* [ ] Everything works after refresh
* [ ] Build passes
* [ ] Lint passes
* [ ] Ready for Prompt #4
