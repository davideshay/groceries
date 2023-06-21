# Login / Logout

This screen will be presented at application startup, and if you haven't yet logged in to the app, you will see a login screen presented asking for the API server URL, user name and password.

## API Server URL

If your system administrator / installer has configured the web application, it will default to your own locally hosted API server URL and you would not need to change. Similarly, the default URL can be "baked" in to the Android application package. If this default shows up as ```https://groceries.mydomain.com/api``` then you will definitely need to change it to the URL provided by your system administrator (see installation guide for more details)

## Creating a new user

To create an account you must provide:
- Username -- you will use this in the future to login to your account. It cannot be changed once created, and is case-sensitive
- E-mail address -- this will be used to process forgotten password requests as well as friend requests. To use this, your system administrator must have enabled/configured the ability to send emails.
- Full Name - your full name -- used primarily for the friend request screen
- Password - to be used to login to the application. Currently no standards are applied

## Resetting your password

From the main login screen, you can select the "Forgot Password" button. This will send you a link to reset the password on the server. If your system administrator has not enabled email functionality, you will need to contact them directly to reset your password.

## Logout

Will log you out of the app and remove credentials, so you will need to provide user name and password to login again.

## Work Offline

Under certain circumstances, such as when connectivity is lost with the application or database server, then you may be asked if you want to work offline. Once selected, the sync icon in the upper right hand corner will change to offline mode. Once you regain connectivity, you can click the login button again and you will be reconnected automatically.

