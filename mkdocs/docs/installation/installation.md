# Installation process for System Admins

* For mobile/web access you can either:
    * Install via Docker
    * Run the code on an existing web server. You will have to build the output using "ionic build" and then deploy to your web server.
* Installation instructions for web/mobile app (docker)
    * Use the Dockerfile in client/Dockerfile to build an image to deploy.  Alternatively, use the latest version on ghcr - for instance:
    ```docker pull ghcr.io/davideshay/groceries-server:1.1.2```
    * You should have a ".env" file locally with an assignment pointing to your backend/API component. For development, this might be something like:
    ```DEFAULT_API_URL=http://localhost:3333```
    For production, this might be:
    ```DEFAULT_API_URL=https://groceries.mydomain.com/api```
* Installation instructions for Android / iOS
    * Ensure you have Ionic and Capacitor installed on your machine, per the instructions on those websites. For android, you will need the Android Studio installed, or xCode for iOS.
    * In the client directory, do `npm install`.
    * Sync the sources with `npx capacitor sync` or `ionic capacitor sync`
    * Build the application, with, for example for Android: `ionic capacitor build android`
    * You can test in a simulator, or move the bundle/APK to your Android device with Google Drive or any other sideloading mechanism of your choice.
    * For Android, the easiest installation is to use the .APK file attached to each release on Github. The only difference from "building your own" is that the default API URL will not be your custom site/domain and will need to be changed. There is now also a release available on the Google Play store: 
    ```https://play.google.com/store/apps/details?id=net.shaytech.groceries```
* Installation instructions for backend - Docker / Kubernetes
    * For a complete docker-compose example see the docker compose file here: [docker-compose.yaml](https://raw.githubusercontent.com/davideshay/groceries/master/mkdocs/docs/assets/docker-compose.yaml) and the instructions here: [Docker Setup](https://davideshay.github.io/groceries/installation/docker-setup/) . A more comprehensive example using reverse-proxy, suitable for use on a VPS can be found here: [docker-full.tar.gz](https://raw.githubusercontent.com/davideshay/groceries/master/mkdocs/docs/assets/docker-full.tar.gz)  
    * Deploy couchDB to a production server, and note the admin user/password (these will be needed for the node backend). For couchDB you will also have to enable JWT authentication and set an HMAC key.  See example YAML for Kubernetes deployment [couchdb.yaml](https://raw.githubusercontent.com/davideshay/groceries/master/mkdocs/docs/assets/couchdb.yaml)  .  Be sure to change any admin users, passwords, and secrets in that file as appropriate.
        * The first piece is setting the admin password in pbkdf2 format. You can use various online sites to do this, or set the password in plain text in the password.ini file and then let couchDB hash it for you automatically. You can then record the hashed value (updated in the file) and use that going forward.
        * The next challenge is setting up the HMAC key. In the jwt.ini file, you need to set the HMAC key. Come up with a random key, and in this file set it to the base64 encoded value. Later, in the deployment of the groceries auth server, you will use the un-encoded/raw value of this secret key. The application server startup will make sure that these keys match and are set appropriately, and if an error exists will try to log a helpful message for what the values should be set to.
        * The yaml file sets up 3 separate instances of couchdb so they can run as a cluster.  I wanted this for high-availablity of couchDB, but this is not necessary.
        * The yaml file shown above also has some setup scripts that run -- these are mostly for convenience so that at first run it will automatically create the _users database and _replicator database, both of which are required for standard couchDB replication and authentication functionality to work. You could create those manually and ignore the scripts. If you are using any of these scripts be sure to change the username and password specified in them to the admin username / password specified above.
    * Build the image from the Dockerfile in server/Dockerfile
    * Deploy to your container server.  Here is a sample yaml deployment file for Kubernetes : [groceries.yaml](https://raw.githubusercontent.com/davideshay/groceries/master/mkdocs/docs/assets/groceries.yaml). Make sure to change your couchDB admin user names and passwords to what you have established in the CouchDB deployment above. Also, set the HMAC key to the unencoded/raw HMAC secret linked to the one in the CouchDB setup.
    * Run from your container server (docker, kubernetes, etc.) and ensure the backend is configured with the following environment variables:
    
```
COUCHDB_URL : full couchDB url + port (no database reference)
COUCHDB_INTERNAL_URL : "Internal" URL - Can be used in a kubernetes environment to access the database without going through the ingress layer, but still give out the FQDN ad the COUCHDB_URL.
COUCHDB_DATABASE: CouchDB database name (i.e. groceries)
COUCHDB_HMAC_KEY: A key (plaintext) configured into your couchDB security to allow JWT keys to work. The base64 encoded version of this plaintext should match what is in your jwt.ini file in CouchDB.
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
ENABLE_SCHEDULING: Used if you want automated resolution of conflicts and token expiration (highly recommended).
RESOLVE_CONFLICTS_FREQUENCY_MINUTES: How often to resolve couchDB conflicts and turn them into conflicts which can be viewed by the frontend. Note that this uses time/date stamp of the update and chooses the more recent one. In most cases, except for multiple offline devices making updates to the same item, and then re-syncing to the central database, conflicts shouldn't occur. If they do, please submit an issue.
EXPIRE_JWT_FREQUENCY_MINUTES: Sweep the database and expire old JWT tokens. These would not be able to be used for logins, but this is still good practice and a back-stop.
REFRESH_TOKEN_EXPIRES: A string such as "30d" for 30 days, or "24h" for 24 hours. Can be reasonably long since re-use detection is applied.
ACCESS_TOKEN_EXPIRES: Same type of string, typically shorter as it will be renewed prior to expiration automatically by the refresh token. Could be "1d" or "12h" for example.
DISABLE_ACCOUNT_CREATION: Set to "true" to disable new user account creation in the backend

```
