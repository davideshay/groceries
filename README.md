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
* The application ships with a set of about 250 items and 30 categories. You can add these to the lists or create new items as you go.
* Items are tagged to categories to aid in sorting the list. You can edit and add new categories as well.
* Items also have a "unit of measure" like bag, box, gallon, pound, etc. You can add new units of measure as well.
* List Groups can be shared with friends. You can send a friend request to users not already registered on the app, and they will get an email asking them to sign up. Once the friendship is confirmed by the other user, you can share a list group with them. All lists within the list group are then shared.

## USER GUIDE / TOUR
Here are a few key screens which show how the app works.

### Menu

![](https://raw.githubusercontent.com/davideshay/groceries/master/docs/menu.png)

The menu shows first the lists and list groups available to the user. In this case, there is list group "Grocery Stores", with 2 lists - Publix and Wegman's. There is also a list group called "Hardware Stores" with 2 lists - Home Depot and Lowes.  If you click on the name of the list or list group itself, you will be taken to the item entry/checkoff screen. If you click to the right on the pencil, you will be taken to the list or listgroup editor screen.
l
Other items on the menu include options to create a new list, list/edit the list groups, list/edit the categories, list/edit the items (across all lists), show the global items (the ones which come pre-populated with the app). Also, you can show/add friends,  view the sync "conflict" log in the rare occurence that conflicts arise, and show/change the app settings.

### Item Entry / Checkoff Screen

![](https://raw.githubusercontent.com/davideshay/groceries/master/docs/items.png)

This screen is really the heart of the application.  At the top of the application there is a search bar where you can search for and easily add items that are in the global pre-populated list or those that you have previously entered.  The next section allows you to "check the item off" the list when you have purchased it by clicking on the checkbox. If you click on the name itself, you will be taken to the item editor where you can change quantity, unit of measure, or category.

The items are listed in order by category. These are listed in the order that the categories are arranged in the list editor.

After all of the "active" items on the list, the app will show that the checked off items, as well as a button to delete or clear the completed items.

The item entry screen works slightly differently depending on whether you have selected a list group in the upper right hand corner or a list. If you have selected a list group (this would be the most common way when you are adding items to the list), then every time you create a new item it is added to all of the lists in the listgroup. The main difference with choosing a list is that then you get the correct sorting by category that the store has, as defined in the list editor. You would typically use list mode when shopping for the items at the store.

### Searching for items

![](https://raw.githubusercontent.com/davideshay/groceries/master/docs/search.png)

When you first enter the search bar, a list of all available items to add to the list will appear. Items that you've purchased before will sort towards the top of the list based on number of times purchased at the store, so you can easily add the items you always buy. 

As you start typing, the list will be filtered by the letters typed in to the search bar.

### Item Editor

![](https://raw.githubusercontent.com/davideshay/groceries/master/docs/itemedit.png)

The item editor allows you to change the name of the item (only if it isn't one of the pre-supplied items).  It also allows you to select the category that the item is in (which determines the sorting position in the store). You can also change the quantity and unit of measure on this screen, as well as provide a note for the item.

On this screen, if you enter those values, they will be applied to every list that the item is on.  This is probably the "standard" way you would want it to work, but there are certain cases where you might want to buy 2 bunches of bananas at Publix, where they are always greener, and 1 bunch of bananas at Wegman's where they are riper.  If you want to change any of the values individually at the list level you can click on the bottom part of the screen on the pencil button by the list.  Items will be shown there highlighted if there are any differences from that item and the rest of the items.

Here you will see this screen:

![](https://raw.githubusercontent.com/davideshay/groceries/master/docs/itempopup.png)

Here you can change the following values:

*  Active -- this is the same as being "on" the list and available for shopping
*  Completed -- the item is "checked off" on the list and would appear at the bottom of the item entry screen
*  Stocked Here -- this is maintained so you can denote whether an item is available in a specific store. This can be useful if you want to use a list group with multiple stores, where for instance, the Publix doesn't carry Birch Beer but the Wegman's does.  When adding to a list, the app will never add to stores that don't stock the item.
*  Category - an item could be in a different section of one store vs another.  For example, the Publix might carry Soy Sauce in the "Asian" section, but the Wegman's has it in the "Condiments" section.
*  Quantity - you might want to buy a different quantities of the same item in different stores.
*  Reset -- The number of times the item has been purchased from the store -- used in item sorting in the search bar. You can reset this if desired by clicking on the reset button.
*  Note - A different note can be maintained for each store.



### List Editor

![](https://raw.githubusercontent.com/davideshay/groceries/master/docs/listedit.png)

Within the list editor, you can change the name of the list.  The other key ability here is to re-arrange the categories within the list to represent the physical order that they appear in the store.  This allows the previously shown item screen to be shown in a logical order easy for shopping.  You can re-arrange the items by dragging on the right hand icon and dragging into the new position.

You can also click on the checkbox of the category and move it from the active list to the inactive. You would do this, for example, if the Publix doesn't have an Alcohol section. This works in conjunction with the Setting (shown later) "Add with Same Categories Automatically".

When you first create a list, you can assign it to a list group. After that point it cannot be changed and moved to another list group. 

### List Group Editor

![](https://raw.githubusercontent.com/davideshay/groceries/master/docs/listgroupedit.png)
 
In the list group editor, you can change the name of the list group. You likely want to change the name of the default list group that the application creates for you, which would not be very meaningful.

The key thing you can do in this screen is also share the list group with your existing friends (See Friend Editor for more detail).  

Here, if you are the list group owner, you can select those friends you want to share the list group with. This would be common in a multi-family household so everyone can participate in adding items to the same shared shopping list and also being able to shop or check items off. 

Note that the sharing is for the whole list group. You can, however, create a different list group with different sharing options. To do this you would go to the manage list groups screen and press the "+" button to add a new listgroup.

### Friends Editor

![](https://raw.githubusercontent.com/davideshay/groceries/master/docs/friends.png)

From this screen, you will see a list of existing friends, and those in different statuses. In the example shown, for instance, you have already sent an invite to "Friend 5" at their GMail address, but they haven't yet registered for an account on the app. If they have misplaced their email to register, you can click on the URL button and share the URL with your friend so they can register in the app.

If someone had requested you to be their friend, and you are both already in the app, you will see a button for you to confirm the friendship. You can only share listgroups once you have confirmed the friendship. Once confirmed, the friendship is bi-directional.

You can also click on the "+" button at the bottom of the screen in order to add a new friend. You enter their email address and if the person is not yet a user, it will send them an email to register for an account. If they are already a user, they will be prompted when they login to the app to confirm the friendship. A number "badge" will appear next to the Friends menu item as well.

### Category Editor

![](https://raw.githubusercontent.com/davideshay/groceries/master/docs/categorylist.png)

You will see a list of available categories, both those that came pre-loaded with the system, as well as those that you have entered. When you click on a category here, you can edit the category.

![](https://raw.githubusercontent.com/davideshay/groceries/master/docs/categoryedit.png)

There are not many settings available to edit. There is a color you can assign to the category as well as editing the name, but the color is not yet used in the app. This is a pending feature.

### Settings

![](https://raw.githubusercontent.com/davideshay/groceries/master/docs/settings.png)

The settings control how portions of the application work.

The top portion shows information about the app and the currently logged in user.  You can "logout" by pressing the logout button which will require you to sign in again. If you do not logout, you will be automatically logged in again whenever you visit the website as long as your token has not expired (this is a time set by the administrator, but defaults to 30 days).  Every time you login, you reset this day limit.

If you experience significant application errors or simply wish to no longer use the app, you can choose the "DELETE LOCAL DATA" button. This will delete the local database and it will be re-synced from the server when you login again. This option also logs you out and requires you to login again.

There are 3 different options that are centered around how items are added to lists with relation to other lists in the same list group:

* Add in Same Group automatically -- When selected, if you have Wegman's and Publix in your Grocery Store list group, and you add Apples to the Wegman's list, they will automatically be added to the Publix list as well. The only exception to this would be if the item wasn't stocked at the the other stores on the list (as shown on the item editor screen).  This is the default setting. This is also the automatic behavior when you have selected the list group level ("Grocery Stores") on the Item List entry/ check off screen.
* Add with same categories automatically -- This is similar to the first, but it will only add to the other lists if that store has the same category of items. For instance, if you say that Publix doesn't have an Alcohol section but Wegman's does, if you add beer on to the Wegman's list, it will not automatically be entered on the Publix list.
* Do not add automatically -- Items are only added to the selected list. If a list group is selected, it will still automatically add it to all stores in the list group.

Other Settings:

* Remove items from list group when marked as purchased -- If you are shopping on the Wegman's list, and you check off the apples from the list, with this setting turned on it will also automatically check the apples off the Wegman's list as well. This makes it easy if you are going to maybe 2 grocery stores and want to shop for things at either store. This is convenient if you have for instance a store like Sam's Club or Costco and might be able to buy several things from your grocery list, but still need to go to the Wegman's to pick up your remaining items.
* Delete from all lists in group when deleting completed items -- When you press the "delete completed items" button, this will remove the items from all other stores in the list group as well. This is convenient in the above scenario as well as you don't need to delete the completed items off of multiple stores in the list group.
* Days of Conflict Log to view -- in the rare event of a conflict, you will see a triangle warning indicator in the upper right hand corner of the screen next to the cloud/sync indicator. If you click this icon or choose "Conflict Log" from the menu item, you will only be shown conflicts from the selected number of days in the past. If conflicts do occur you can view them in the conflict log and see which was the "winning" and "losing" document, so you can make additional changes or coordinate with family members as required. Once you have viewed the conflict log, you can also "Set as Viewed" on the conflict log screen so you will not see those items again.


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
    * Run the code on an existing web server. You will have to build the output using "ionic build" and then deploy to your web server.
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
* Installation instructions for backend - Docker / Kubernetes
    * Deploy couchDB to a production server, and note the admin user/password (these will be needed for the node backend). For couchDB you will also have to enable JWT authentication and set an HMAC key.  See example YAML for Kubernetes deployment (similar concepts could be used for Docker using the same concepts to create a compose file. Unfortunately I have moved to Kubernetes instead of docker compose files, so I don't have a working example). [couchdb.yaml](https://raw.githubusercontent.com/davideshay/groceries/master/docs/couchdb.yaml)  .  Be sure to change any admin users, passwords, and secrets in that file as appropriate.
        * The first piece is setting the admin password in pbkdf2 format. You can use various online sites to do this, or set the password in plain text in the password.ini file and then let couchDB hash it for you automatically. You can then record the hashed value (updated in the file) and use that going forward.
        * The next challenge is setting up the HMAC key. In the jwt.ini file, you need to set the HMAC key. Come up with a random key, and in this file set it to the base64 encoded value. Later, in the deployment of the groceries auth server, you will use the un-encoded/raw value of this secret key.
        * The yaml file sets up 3 separate instances of couchdb so they can run as a cluster.  I wanted this for high-availablity of couchDB, but this is not necessary.
        * The yaml file shown above also has some setup scripts that run -- these are mostly for convenience so that at first run it will automatically create the _users database and _replicator database, both of which are required for standard couchDB replication and authentication functionality to work. You could create those manually and ignore the scripts. If you are using any of these scripts be sure to change the username and password specified in them to the admin username / password specified above.
    * Build the image from the Dockerfile in server/Dockerfile
    * Deploy to your container server.  Here is a sample yaml deployment file for Kubernetes that can be leveraged to create a docker compose file if required : [groceries.yaml](https://raw.githubusercontent.com/davideshay/groceries/master/docs/groceries.yaml). Make sure to change your couchDB admin user names and passwords to what you have established in the CouchDB deployment above. Also, set the HMAC key to the unencoded/raw HMAC secret linked to the one in the CouchDB setup.
    * Run from your container server (docker, kubernetes, etc.) and ensure the backend is configured with the following environment variables:
    
```
COUCHDB_URL : full couchDB url + port (no database reference)
COUCHDB_INTERNAL_URL : "Internal" URL - Can be used in a kubernetes environment to access the database without going through the ingress layer, but still give out the FQDN ad the COUCHDB_URL.
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
ENABLE_SCHEDULING: Used if you want automated resolution of conflicts and token expiration (highly recommended).
RESOLVE_CONFLICTS_FREQUENCY_MINUTES: How often to resolve couchDB conflicts and turn them into conflicts which can be viewed by the frontend. Note that this uses time/date stamp of the update and chooses the more recent one. In most cases, except for multiple offline devices making updates to the same item, and then re-syncing to the central database, conflicts shouldn't occur. If they do, please submit an issue.
EXPIRE_JWT_FREQUENCY_MINUTES: Sweep the database and expire old JWT tokens. These would not be able to be used for logins, but this is still good practice and a back-stop.
REFRESH_TOKEN_EXPIRES: A string such as "30d" for 30 days, or "24h" for 24 hours. Can be reasonably long since re-use detection is applied.
ACCESS_TOKEN_EXPIRES: Same type of string, typically shorter as it will be renewed prior to expiration automatically by the refresh token. Could be "1d" or "12h" for example.

```


