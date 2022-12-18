const couchdbUrl = process.env.COUCHDB_URL.endsWith("/") ? process.env.COUCHDB_URL.slice(0,-1): process.env.COUCHDB_URL;
const couchDatabase = process.env.COUCHDB_DATABASE;
const couchKey = process.env.COUCHDB_HMAC_KEY;
const couchAdminUser = process.env.COUCHDB_ADMIN_USER;
const couchAdminPassword = process.env.COUCHDB_ADMIN_PASSWORD;
const couchStandardRole = "crud";
const couchAdminRole = "dbadmin";
const couchUserPrefix = "org.couchdb.user";
const jose = require('jose');
const axios = require('axios');
const e = require('express');
const _ = require('lodash');

async function couchLogin(username, password) {
    const loginResponse = {
        loginSuccessful: true,
        loginRoles: []
    }
    const config = {
        method: 'get',
        url: couchdbUrl+"/_session",
        auth: { username: username, password: password},
        responseType: 'json'
    }
    let res=null;
    try  {res = await axios(config)}
    catch(err) {loginResponse.loginSuccessful = false};
    if (loginResponse.loginSuccessful) {
        if (res.status != 200) {
            loginResponse.loginSuccessful = false;
        }
        if (loginResponse.loginSuccessful && (res.data?.ok != true)) {
            loginResponse.loginSuccessful = false;
        }
    }
    if (loginResponse.loginSuccessful) {
        loginResponse.loginRoles = res.data.userCtx.roles;
    }
    return(loginResponse);

}

function getNested(obj, ...args) {
    return args.reduce((obj, level) => obj && obj[level], obj)
  }

async function doesDBExist() {
    let doesDBExist = false;
    const config = {
        method: 'get',
        url: couchdbUrl+"/"+couchDatabase,
        auth: {username: couchAdminUser, password: couchAdminPassword},
        validateStatus: function(status) { return true},
        responseType: 'json'
    }
    let retrieveError = false;
    let res = null;
    try { res = await axios(config)}
    catch(err) { retrieveError = true }
    if (retrieveError) {
        console.log("ERROR: could not retrieve database info.");
        return (false);
    }
    if (res.status == "200") {
        console.log("STATUS: Database "+ couchDatabase + " already exists");
        doesDBExist = true;};
    return (doesDBExist);
}

async function createDB() {
    const config = {
        method: 'put',
        url: couchdbUrl+"/"+couchDatabase,
        auth: {username: couchAdminUser, password: couchAdminPassword},
        responseType: 'json'
    }
    let createError = false;
    let res = null;
    try { res = await axios(config)}
    catch(err) {  createError = true }
    if (createError) return (false);
    if (res.status == "400"||res.status == "401"|| res.status=="412") {
        console.log("ERROR: Problem creating database "+couchDatabase);
        return(false);
    }
    if (typeof res.data?.ok == undefined) return(false);
    console.log("STATUS: Initiatialization, Database "+couchDatabase+" created.");
    return (res.data.ok);
}

async function createDBIfNotExists() {
    let dbCreated=false
    if (!(await doesDBExist())) {
        dbCreated=await createDB()
    }
    return (dbCreated)
}

async function setDBSecurity() {
    errorSettingSecurity = false;
    let config = {
        method: 'get',
        url: couchdbUrl+"/"+couchDatabase+"/_security",
        auth: {username: couchAdminUser, password: couchAdminPassword},
        responseType: 'json'
    }
    let res = null;
    try { res = await axios(config)}
    catch(err) { console.log(err); errorSettingSecurity= true }
    if (errorSettingSecurity) return (!errorSettingSecurity);
    let newSecurity = _.cloneDeep(res.data);
    let securityNeedsUpdated = false;
    if ((getNested(res.data.members.roles.length) == 0) || (getNested(res.data.members.roles.length) == undefined)) {
        newSecurity.members.roles = [couchStandardRole];
        securityNeedsUpdated = true;
    } else {
        if (!res.data.members.roles.includes(couchStandardRole)) {
            newSecurity.members.roles.push(couchStandardRole);
            securityNeedsUpdated = true;
        }
    }
    if ((getNested(res.data.admins.roles.length) == 0) || (getNested(res.data.admins.roles.length) == undefined)) {
        newSecurity.admins.roles = [couchAdminRole];
        securityNeedsUpdated = true;
    } else {
        if (!res.data.admins.roles.includes(couchAdminRole)) {
            newSecurity.admins.roles.push(couchAdminRole);
            securityNeedsUpdated = true;
        }
    }
    if (!securityNeedsUpdated) {
        console.log("STATUS: Security roles set correctly");
        return (true);
    }
    config = {
        method: 'put',
        url: couchdbUrl+"/"+couchDatabase+"/_security",
        auth: {username: couchAdminUser, password: couchAdminPassword},
        responseType: 'json',
        data: newSecurity
    }
    errorSettingSecurity = false;
    try { res = await axios(config)}
    catch(err) { console.log("got error : ", err); errorSettingSecurity = true }
    if (errorSettingSecurity) {
        console.log("ERROR: Problem setting database security")
    } else {
        console.log("STATUS: Database security roles added");
    }
    return (!errorSettingSecurity);
}

async function dbStartup() {
    console.log("STATUS: Starting up auth server for couchdb...");
    console.log("STATUS: Database URL: ",couchdbUrl);
    console.log("STATUS: Using database: ",couchDatabase);
    await createDBIfNotExists();
    await setDBSecurity();
}

async function getUserDoc(username) {
    const userResponse = {
        error: false,
        fullname: "",
        email: ""
    }
    const config = {
        method: 'get',
        url: couchdbUrl+"/_users/"+ encodeURI(couchUserPrefix+":"+username),
        auth: {username: couchAdminUser, password: couchAdminPassword},
        responseType: 'json'
    }
    let res = null;
    try { res = await axios(config)}
    catch(err) { userResponse.error= true }
    if (!userResponse.error) {
        userResponse.email = res.data?.email;
        userResponse.fullname = res.data?.fullname;
    }
    return (userResponse);
}

async function generateJWT(username) {
    const alg = "HS256";
    const secret = new TextEncoder().encode(couchKey)
    const jwt = await new jose.SignJWT({'sub': username, '_couchdb.roles': [couchStandardRole,couchAdminRole,"_admin"]})
        .setProtectedHeader({ alg })
        .setIssuedAt()
        .setExpirationTime("5s")
        .sign(secret);  
    return (jwt);
}

async function checkUserExists(req, res) {
    const { username } = req.body;
    let response = {
        username: username,
        userExists: false
    }
    let userResponse = await getUserDoc(username);
    response.userExists = !userResponse.error;
    return (response);
}

async function getUserByEmailDoc(email) {
    const userResponse = {
        error: false,
        username: null,
        fullname: null,
        email: email,
    }
    const config = {
        method: 'post',
        url: couchdbUrl+"/_users/_find",
        auth: {username: couchAdminUser, password: couchAdminPassword},
        data: {selector: {"email": {"$eq": email}},
                fields: ["name", "email", "fullname"]},
        responseType: 'json'
    }
    let res = null;
    try { res = await axios(config)}
    catch(err) { console.log(err); userResponse.error= true }
    if (!userResponse.error) {
        if (res.statusCode == 200 && res.data.docs.length > 0) {
            userResponse.username = res.data?.docs[0].name;
            userResponse.email = res.data?.docs[0].email;
            userResponse.fullname = res.data?.docs[0].fullname;
        }
    }
    return (userResponse);
}

async function checkUserByEmailExists(req, res) {
    const { email} = req.body;
    let response = {
        username: null,
        fullname: null,
        email: null,
        userExists: false
    }
    let userResponse = await getUserByEmailDoc(email);
    if (userResponse.error) { response.userExists = false;}
    else {
        response.username = userResponse.username;
        response.email = userResponse.email;
        response.fullname = userResponse.fullname;
    }
    return (response);
}


async function issueToken(req, res) {
    const { username, password } = req.body;
    let response = {
        loginSuccessful: false,
        email: "",
        fullname: "",
        loginRoles: [],
        loginJWT: "",
        couchdbUrl: process.env.COUCHDB_URL,
        couchdbDatabase: process.env.COUCHDB_DATABASE
    }
    let loginResponse = await couchLogin(username,password);
    if (!loginResponse.loginSuccessful) return (response);

    let userDoc = await getUserDoc(username);
    if (loginResponse.loginSuccessful && !(userDoc.error)) {
         response.loginSuccessful = loginResponse.loginSuccessful;
         response.loginRoles = loginResponse.loginRoles;
         response.email = userDoc.email;
         response.fullname = userDoc.fullname;
         response.loginJWT = await generateJWT(username);
     }
    return(response);

}

async function createNewUser(userObj) {
    const createResponse = {
        error: false,
        idCreated: ""
    }
    const config = {
        method: 'put',
        url: couchdbUrl+"/_users/"+ encodeURI(couchUserPrefix+":"+userObj.username),
        auth: {username: couchAdminUser, password: couchAdminPassword},
        data: {
            name: userObj.username,
            password: userObj.password,
            email: userObj.email,
            fullname: userObj.fullname,
            roles: [couchStandardRole],
            type: "user"
        },
        responseType: 'json'
    }
    let res = null;
    try { res = await axios(config)}
    catch(err) { createResponse.error= true }
    if (!createResponse.error) {
        createResponse.idCreated = res.data.id;
    }
    return (createResponse);
}

function isNothing(obj) {
    if (obj == "" || obj == null || obj == undefined) {return (true)}
    else {return (false)};
}

async function registerNewUser(req, res) {
    const registerResponse = {
        invalidData: false,
        userAlreadyExists: false,
        createdSuccessfully: false,
        idCreated: "",
        jwt: "",
        couchdbUrl: process.env.COUCHDB_URL,
        couchdbDatabase: process.env.COUCHDB_DATABASE
    }
    const {username, password, email, fullname} = req.body;

    if (isNothing(username) || isNothing(password) || isNothing(email) || isNothing(fullname)) {
        registerResponse.invalidData = true;
        return (registerResponse);
    }

    let userDoc = await getUserDoc(username);
    if (!userDoc.error) {
        registerResponse.userAlreadyExists = true;
    } 
    if (!registerResponse.userAlreadyExists)  {
        let createResponse = await createNewUser({username: username, password: password, email: email, fullname: fullname})
        registerResponse.createdSuccessfully = !createResponse.error;
        registerResponse.idCreated = createResponse.idCreated;
        registerResponse.jwt = await generateJWT(username);
    }
    return (registerResponse);
}

async function getUsersInfo(req, res) {
    // input - json list of userIDs : userIDs: ["username1","username2"] -- should be _users ids 
    //        without the org.couchdb.user prefix
    // return - json array of objects:
    //        [ {userID: "username1", email: "username1@gmail.com", fullName: "User 1"},
    //          {userID: "username2", email: "username2@yahoo.com", fullName: "User 2"}]

    const getResponse = {
        error: false,
        users: [],
    }
//    console.log("req is:",{req});
    if (isNothing(req.body?.userIDs)) {getResponse.error=true; return (getResponse)}
    const requestData = { keys: [], include_docs: true }
    req.body.userIDs.forEach(uid => { requestData.keys.push(couchUserPrefix+":"+uid) });
    const config = {
        method: 'post',
        url: couchdbUrl+"/_users/_all_docs",
        auth: {username: couchAdminUser, password: couchAdminPassword},
        data: requestData,
        responseType: 'json'
    }
    let userRes = null;
    try { userRes = await axios(config)}
    catch(err) { console.log(err); getResponse.error= true }
    if (!getResponse.error) {
        console.log(userRes.data.rows)
        userRes.data.rows.forEach(el => {
            getResponse.users.push({name: el?.doc?.name, email: el?.doc?.email, fullname: el?.doc?.fullname})
        });
    }
    return(getResponse);
}

module.exports = {
    issueToken,
    checkUserExists,
    checkUserByEmailExists,
    registerNewUser,
    dbStartup,
    getUsersInfo
}