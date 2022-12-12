const couchdbUrl = process.env.COUCHDB_URL;
const couchDatabase = process.env.COUCHDB_DATABASE;
const couchKey = process.env.COUCHDB_HMAC_KEY;
const couchAdminUser = process.env.COUCHDB_ADMIN_USER;
const couchAdminPassword = process.env.COUCHDB_ADMIN_PASSWORD;
const jose = require('jose');
const axios = require('axios');

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

async function getUserDoc(username) {
    const userResponse = {
        error: false,
        fullname: "",
        email: ""
    }
    const config = {
        method: 'get',
        url: couchdbUrl+"/_users/"+ encodeURI("org.couchdb.user:"+username),
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
    const jwt = await new jose.SignJWT({'sub': username})
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

async function issueToken(req, res) {
    const { username, password } = req.body;
    let response = {
        loginSuccessful: false,
        email: "",
        fullname: "",
        loginRoles: [],
        loginJWT: ""
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
        url: couchdbUrl+"/_users/"+ encodeURI("org.couchdb.user:"+userObj.username),
        auth: {username: couchAdminUser, password: couchAdminPassword},
        data: {
            name: userObj.username,
            password: userObj.password,
            email: userObj.email,
            fullname: userObj.fullname,
            roles: [],
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
        userAlreadyExists: true,
        createdSuccessfully: false,
        idCreated: "",
        jwt: ""
    }
    const {username, password, email, fullname} = req.body;

    if (isNothing(username) || isNothing(password) || isNothing(email) || isNothing(fullname)) {
        registerResponse.invalidData = true;
        return (registerResponse);
    }

    let userDoc = await getUserDoc(username);
    if (userDoc.error) {
        registerResponse.userAlreadyExists = false;
    } 
    if (!registerResponse.userAlreadyExists)  {
        let createResponse = await createNewUser({username: username, password: password, email: email, fullname: fullname})
        registerResponse.createdSuccessfully = !createResponse.error;
        registerResponse.idCreated = createResponse.idCreated;
        registerResponse.jwt = await generateJWT(username);
    }
    return (registerResponse);
}

module.exports = {
    issueToken,
    checkUserExists,
    registerNewUser
}