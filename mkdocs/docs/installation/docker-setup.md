# Groceries App -- Docker Compose setup

## Initial setup

The easiest way to get started is to use this file [docker-simple.tar.gz](https://raw.githubusercontent.com/davideshay/groceries/master/mkdocs/docs/assets/docker-simple.tar.gz) which contains a working ```docker-compose.yaml``` file along with the associated data directories/volumes.  Extract the file to a new directory, and type ```docker-compose up``` and you should be working.  This is setup for single-node processing, with services running on localhost and initially only accessible via that localhost. See places in the ```docker-compose.yaml``` marked as "CHANGEME" for those you would want to change for a full production deployment.

In order to get any Android/IOS device working, you will have to change at a minimum the COUCHDB_URL variable for the backend server to something that is resolvable and routable by your mobile device. How you do this is dependent on your own local DNS/host setup, but it could be as simple as making COUCHDB_URL your host/server machine's IP address as long as it is accessible to your mobile/client device.

You can extrapolate from here to add reverse proxies, https/letsencrypt, etc..  A full example docker-compose file with directories that would be relatively easy to modify to work on a VPS or otherwise, including Caddy as a reverse-proxy can be found here: [docker-full.tar.gz](https://raw.githubusercontent.com/davideshay/groceries/master/mkdocs/docs/assets/docker-full.tar.gz) .  If you start with either of these, please change contents such as couchDB admin passwords and the HMAC key values following the instructions below so you can secure your environment. 

* The docker-compose has 3 volumes setup as 2 subdirectories and 1 file:
    * File [groceries-web.conf](https://raw.githubusercontent.com/davideshay/groceries/master/mkdocs/docs/assets/groceries-web.conf) -- see file in docs directory for contents. Just sets up some defaults for nginx.
    * Directory ```./dbdata``` -- will have the database files
    * Directory ```./dbetclocal``` -- has configuration files for couchdb. Should start with two files called [admin.ini](https://raw.githubusercontent.com/davideshay/groceries/master/mkdocs/docs/assets/admin.ini) which contains the startup user/password. See admin.ini in docs directory for contents.  Other file should be [jwt.ini](https://raw.githubusercontent.com/davideshay/groceries/master/mkdocs/docs/assets/jwt.ini) which you will need to update with your personal HMAC key (base64 encoded) on the line that starts with ```hmac:_default```.
* Launch the file with ```docker-compose up```. Because it now has the ```single_node``` key in ```jwt.ini``, CouchDB will setup and automatically create the _users and _replicator system databases.
* There are two different ways to change the password:
    * If you are mainly doing a configuration as code type approach, first, you might want to change to bind-mounting the config files mounted to ```/opt/couchdb/etc/local.d directory```, for both ```admin.ini``` and ```jwt.ini```. If you do that, you can change the password in admin.ini. You can generate this using techniques such as those that are shown [here](https://sleeplessbeastie.eu/2020/03/13/how-to-generate-password-hash-for-couchdb-administrator/).  Once you have the value, change the string after ```admin=-pbkdf2-``` in the ```admin.ini``` file to the value returned.
    * Alternatively, login at [http://localhost:5984/_utils](http://localhost:5984/_utils) with the user (admin/password) , go to the settings tab and change the admin password.  This will write a new password to ```jwt.ini```. You can then delete the ```admin.ini``` file.
* Regardless of which method was used, in the ```docker-compose.yml``` file change the groceries backend environment variable ```COUCHDB_ADMIN_PASSWORD``` to match.    
* Login to the couchDB web UI [http://localhost:5984/_utils](http://localhost:5984/_utils) and validate that CORS is set correctly (it should be open). Validate that the _users and _replicator databases have been created.
* You may need to restart the services with docker compose up/down or restart to apply the password changes and HMAC key changes.
* Review all other entries in ```docker-compose.yml``` to match the instructions in the [installation](https://davideshay.github.io/groceries/installation/installation/) section of the documentation.

## Create a user

* Navigate to http://localhost:8100.
* Choose the "CREATE ACCOUNT" button.
* Enter in all relevant details. If you wish to be able to reset your password with the UI, make sure you enter a valid email and make sure you have the email setup in the environment variables for the groceries server (SMTP_*)
