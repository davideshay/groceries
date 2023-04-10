# Groceries App -- Docker Compose setup

## Initial setup

Use the docker-compose.yaml file from the docs directory to start with. This is setup for single-node processing, with services running on localhost. You can extrapolate from here to add reverse proxies, https/letsencrypt, etc..

* The docker-compose has 3 volumes setup as 2 subdirectories and 1 file:
    * File groceries-web-conf -- see file in docs directory for contents. Just sets up some defaults for nginx.
    * Directory ./dbdata -- will have the database files
    * Directory ./dbetclocal -- has configuration files for couchdb. Should start with two files called admin.ini which contains the startup user/password. See admin.ini in docs directory for contents.  Other file should be jwt.ini which you will need to update with your personal HMAC key on the line that starts with "hmac:_default".
* Launch the file with docker-compose up. CouchDB will start, but is not yet configured. You will need to do the following steps after it launches.
* Go to the following URL: http://localhost:5984/_utils
* Login with the user (admin/admin in the files).
* Go to the settings tab (gear on the left) and click on CORS. Enable for all domains (can be more specific if needed)
* Go to the databases tab (cylinder icon on the left). Create the _users and _replicator system databases.
* Stop the docker compose stack.
* Restart the docker compose stack (docker compose up). CouchDB will take a minute or two to start, and then the backend/server should start as well. 

## Create a user

* Navigate to http://localhost:8100
