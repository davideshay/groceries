# Key Concepts for System Admins

* There are two main components -- a frontend which, using Ionic Capacitor, can be run on the web/mobile or installed to Android or iOS devices. There is also a backend, which consists of a nodeJS application. Both frontend and backend app require access to a couchDB database. This database has a local syncing feature known as PouchDB, and enables rapid syncing as well as conflict resolution, and the ability to create an "offline-first, sync-first" type approach ideally suited to this application.
* If you desire web/mobile access without an app, you can build and install the code from the client directory to any webserver.
* The backend should be installed on a server with nodeJS access, and also will require couchDB to be installed.  Without a backend and couchDB being installed the application will be severely limited and will not be able to:
    * Sync / save data with the cloud
    * Share lists between users
    * Sync with multiple devices
* Dockerfiles are available in the source for easy creation of a frontend image and a backend image. These can be run on any container environment, including Kubernetes. You can use the standard couchDB images to standup a couchDB instance.
* The backend uses JWT tokens to authenticate with the frontend (web, mobile, or apps). A refresh token is used with a fairly long refresh time as a default, so the user won't have to login again if they access within this period. Token re-use detection is active to prevent abuse. An access token is used to access CouchDB as well as the backend, and has a shorter lifespan typically (1 day by default)
