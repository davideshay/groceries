# Groceries App - Open Source / Self Hosted

## ABOUT

Groceries is an open source and self hosted grocery shopping app, with support for web/mobile and Android / iOS.

## FEATURES

* Supports multiple shopping lists and ability to group lists into a list group
* Lists can be shared with other users
* Updates across multiple platforms and users occur in real-time, synced immediately. Conflict resolution occurs automatically and can be viewed.
* Works offline as well, when you don't have internet connectivity. Updates are synced as soon as connectivity resumes.
* List Group support includes the ability to add items to a group of stores automatically, and then if the first store doesn't have an item, it remains on the list for the next store.
* Supports a sorted view of every store by category (aisle), so you don't have to double back in the store

## KEY CONCEPTS FOR USERS

* Normal usage of the Groceries app involves a backend running on a server with access to a CouchDB database. This is used to sync across devices and between shared users.
* You must register with this server, and create a username and password. Once you login to each device, you should not have to sign in again unless the app goes unused for 30 days.
* List Groups - Every user has a default list group created automatically, and every list is assigned to one (and only one) list group.
* Lists are equivalent to a grocery store, and always exist within a given list group (which cannot be changed at this point). Lists (stores) also have a given set of categories (aisles) that are active within the list. For instance, you might have a produce category/aisle at your grocery store, but not in your hardware store.  The sequence of categories/aisles is associated with the list as well, and can be changed to match the layout of each store/list.
* Items are individual things on a shopping list, and are associated with a list group. When you are on the Items page, you can choose whether to add items just to a given list, or to add them to all available lists in the listgroup if a group is selected.
* List Groups can be shared with friends. You can send a friend request to users not already registered on the app, and they will get an email asking them to sign up. Once the friendship is confirmed by the other user, you can share a list group with them. All lists within the list group are then shared.

## KEY CONCEPTS FOR SYSTEM ADMINISTRATORS

* There are two main components -- a frontend which, using Ionic Capacitor, can be run on the web/mobile or installed to Android or iOS devices. There is also a backend, which consists of a nodeJS application. Both frontend and backend app require access to a couchDB database. This database has a local syncing feature known as PouchDB, and enables rapid syncing as well as conflict resolution, and the ability to create an "offline-first, sync-first" type approach ideally suited to this application.
* If you desire web/mobile access without an app, you can build and install the code from the client directory to any webserver.
* The backend should be installed on a server with nodeJS access, and also will require couchDB to be installed.  Without a backend and couchDB being installed the application will be severely limited and will not be able to:
    * Sync / save data with the cloud
    * Share lists between users
    * Sync with multiple devices
* Dockerfiles are available in the source for easy creation of a frontend image and a backend image. These can be run on any container environment, including Kubernetes. You can use the standard couchDB images to standup a couchDB instance.
* The backend uses JWT tokens to authenticate with the frontend (web, mobile, or apps). A refresh token is used with a fairly long refresh time as a default, so the user won't have to login again if they access within this period. Token re-use detection is active to prevent abuse. An access token is used to access CouchDB as well as the backend, and has a shorter lifespan typically (1 day by default)


## INSTALLATION FOR SYSTEM ADMINS
* For mobile/web access you can either:
    * Install via Docker
    * Run the code on an existing web server (unsupported)
* Installation instructions for web/mobile app (docker)
    * Use the Dockerfile in client/Dockerfile to build an image to deploy.
    * You should all a ".env" file locally with an assignment pointing to your backend/API component. For development, this might be something like:
    ```DEFAULT_API_URL=http://localhost:3333```
    For production, this might be:
    ```DEFAULT_API_URL=https://groceries.mydomain.com/api```
* Installation instructions for Android / iOS
    * Ensure you have Ionic and Capacitor installed on your machine, per the instructions on those websites. For android, you will need the Android Studio installed, or xCode for iOS.
    * In the client directory, do `npm install`.
    * Sync the sources with `npx capacitor sync` or `ionic capacitor sync`
    * Build the application, with, for example for Android: `ionic capacitor build android`
    * You can test in a simulator, or move the bundle/APK to your Android device with Google Drive or any other sideloading mechanism of your choice.
* Installation instructions for backend - Docker
    * Deploy couchDB to a production server, and note the admin user/password (these will be needed for the node backend)
    * Build the image from the Dockerfile in server/Dockerfile
    * Deploy to your container server.
    * Run from your container server (docker, kubernetes, etc.) and ensure the backend is configured with the following environment variables:
```
COUCHDB_URL : full couchDB url + port (no database reference)
COUCHDB_DATABASE: CouchDB database name (i.e. todos)
COUCHDB_HMAC_KEY: A key (base64 encoded) configured into your couchDB security to allow JWT keys to work.
COUCHDB_ADMIN_USER: Admin user for couchDB instance (admin)
COUCHDB_ADMIN_PASSWORD: Admin password for CouchDB instance
GROCERY_URL : for testing could be http://localhost:8100, for prod could be https://groceries.mydomain.com
GROCERY_API_URL: for testing could be http://localhost:3333, for prod could be https://groceries.mydomain.com/api  (need to ensure you can route the api prefix to the backend and without the prefix to the web server)
GROCERY_API_PORT: Port for the server to listen on, i.e. 3333 for dev, 80 or 8000 for production, depending on your setup/reverse proxy.
SMTP_HOST: Name for SMTP host which can send emails (for password resets and friend requests to unregistered users)
SMTP_PORT: Port SMTP server runs on
SMTP_FROM: Email address that mail will appear to originate from
SMTP_USER: User name to login to SMTP server
SMTP_PASSWORD: Password for SMTP server
REFRESH_TOKEN_EXPIRES: A string such as "30d" for 30 days, or "24h" for 24 hours. Can be reasonably long since re-use detection is applied.
ACCESS_TOKEN_EXPIRES: Same type of string, typically shorter as it will be renewed prior to expiration automatically by the refresh token. Could be "1d" or "12h" for example.

```

## USER GUIDE / TOUR

