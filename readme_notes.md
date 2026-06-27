Conflict Handling: The application uses Optimistic Concurrency Control with a version field. Updates include the current version number. If another user has already saved changes, the server rejects the stale update with HTTP 409. The frontend displays a conflict dialog, allowing the user to reload the latest version, copy unsaved edits, or continue editing. This implements a Last-Write-Wins strategy while preventing silent data loss.



increase the size of task_shedule in ai sights better ui for that