/* Redirects to login.html if the current page is protected and the user
   has no access token in localStorage. Loaded as the FIRST script on every
   page that requires authentication. */
(function () {
  if (!window.api || !window.api.isAuthed()) {
    location.replace('login.html');
  }
})();
