Prequisites:
- FoundationDB client and server
- Node.js
- Ruby sass gem (if you want to modify the SCSS file)

Startup:
1. npm install
2. node app.js [port]
3. open up http://localhost:[port] in your web browser

You can boot up as many different instances of the chat server as you want (by using different ports).

By default, it will use your local FDB server. You can also create an fdb.cluster file that tells the app which FoundationDB database to use. Read more about the fdb.cluster file here: https://foundationdb.com/documentation/administration.html?highlight=cluster#adding-machines-to-a-cluster

If you have an issue running "npm install" on OS X 10.9, please see http://community.foundationdb.com/questions/892/npm-install-fdb-fails