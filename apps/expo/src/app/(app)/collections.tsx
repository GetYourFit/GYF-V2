// Collections is the same data as Saved (saved items + saved looks); the web
// keeps both routes only until F13 deletes the duplicate. Re-export rather than
// ship a second implementation to maintain, so there is one screen to delete.
export { default } from "./saved";
