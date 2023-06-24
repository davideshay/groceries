# Key Concepts for End Users

* Normal usage of the Groceries app involves a backend running on a server with access to a CouchDB database. This is used to sync across devices and between shared users.
* You must register with this server, and create a username and password. Once you login to each device, you should not have to sign in again unless the app goes unused for 30 days.
* List Groups - Every user has a default list group created automatically, and every list is assigned to one (and only one) list group. Lists, items, categories, and units of measure are all tied to the list group where they are assigned (except for the global items, categories, and units of measure that come with the application).
* Lists are equivalent to a grocery store, and always exist within a given list group (which cannot be changed once created). Lists (stores) also have a given set of categories (aisles) that are active within the list. For instance, you might have a produce category/aisle at your grocery store, but not in your hardware store.  The sequence of categories/aisles is associated with the list as well, and can be changed to match the physical layout of each store/list.
* Items are individual things on a shopping list, and are associated with a list group. When you are on the Items page, you can choose whether to add items just to a given list, or to add them to all available lists in the listgroup if a group is selected.
* The application ships with a set of about 250 items and 30 categories. You can add these to the lists or create new items as you go.
* Items are tagged to categories to aid in sorting the list. You can edit and add new categories as well.
* Items also have a "unit of measure" like bag, box, gallon, pound, etc. You can add new units of measure as well.
* List Groups can be shared with friends. You can send a friend request to users not already registered on the app, and they will get an email asking them to sign up. Once the friendship is confirmed by the other user, you can share a list group with them. All lists within the list group are then shared.
* Recipes are groups of items as well as instructions for preparation. Each item can have set quantities and units of measure for both the recipe as well as for shopping. Recipe items can be added to a list for shopping "en-masse", including the ability to easily skip certain items.
