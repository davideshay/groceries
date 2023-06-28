# Information about upgrading between releases

Most release upgrades simply involve the system administrator upgrading the backend and website versions, and then the end user upgrading their Android/IOS app appropriately.  For all upgrades, it is recommended to take a backup of the couchDB database before proceeding with the upgrade, so if any issues occur, you can recover easily. See [here](https://docs.couchdb.org/en/stable/maintenance/backups.html) for backup/recovery instructions.

Sometimes, however, there is a more significant change requiring some changes to database or other structures. When these occur (such as upgrading from any prior release to the 0.9.x and beyond series), the user may see a warning like this:

![](https://raw.githubusercontent.com/davideshay/groceries/master/mkdocs/docs/assets/warningschema.png){align=right width=300}


When this happens, the easiest thing to do is to choose "Delete/Exit" and then restart or re-login to the app. This will prompt you for your user ID and password again, and will then re-synchronize the data from the server. This is just a one-time action needed to fully update the data on your local device and prevent conflicts from occurring with new structures.

For all upgrades, but particularly those with a schema upgrade, you should ensure that no clients are active when the backend restarts with the new version and performs the schema upgrade.  If you do not do this, you will likely end up with document conflicts created because the client is live. The easiest path forward if this occurs is to simply restore the previous database and then try the upgrade gain, without any clients being active.

## Changing to release 0.9.x from any prior release

The above documented database delete/resync process applies. In addition, the name of the Android application file (".apk") has been changed along with the application name change to "Specifically Clementines". You will need to delete any existing copy of the "groceries" app as it will no longer work and won't be upgraded appropriately in the future. Please switch to using "clementines.apk" as provided with the bundled release.

This release, in addition, has a significant change in the schema, so it may take a minute or two to update on the backend.  To avoid problems, all local clients should not be online while the backend is updating, as noted above.

The major functional changes with release 0.9.x include:
- Any custom / user-created category or unit of measure is now tied to the list group where that category or unit of measure is used, and is only available within that list group.  The upgrade process will try to assign these custom categories and units of measure to the right list group.
- Recipes are now tied to a new user-specific recipe list group. Just like standard list groups, they can be shared with other users to share your recipe content. The upgrade process will create the recipes list group.
- Linking these items to list groups will in a future release enable decreased unnecessary data synchronization as well as an easier ability to host a single server with a larger number of "unrelated" end users with increased performance.
