// Address of the Laravel server used by the Android app.
// Can be changed on the login screen ("Server") without rebuilding the app.
window.RM_CONFIG = {
  SERVER: 'https://chaka.proyashcoaching.com',
  VERSION: '1.0.0',
  BUILD: 0, // the build server writes the real number here for the APK
};
window.RM = window.RM || {};
RM.installers = []; // page modules register themselves here
