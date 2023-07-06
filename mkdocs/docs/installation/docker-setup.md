# Groceries App -- Docker Compose setup

## Initial setup

Use the docker-compose.yaml file from the docs directory to start with. This is setup for single-node processing, with services running on localhost. You can extrapolate from here to add reverse proxies, https/letsencrypt, etc..

* The docker-compose has 3 volumes setup as 2 subdirectories and 1 file:
    * File [groceries-web-conf](https://raw.githubusercontent.com/davideshay/groceries/master/mkdocs/docs/assets/groceries-web-conf) -- see file in docs directory for contents. Just sets up some defaults for nginx.
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
