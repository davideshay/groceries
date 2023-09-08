# Alexa Support

## Introduction

Preliminary Alexa support has been built and an "Alexa Server" component is available.  There is some limited documentation below for how to set this up for a self-hosted environment, but it assumes that you are familiar in general with creating an Alexa skill.

## Basic Setup

- Create an Amazon skill using the "other" type of experience with a "custom" model.
- Set the hosting service to "provision your own".
- Set the skill up to "start from scratch".
- Click on interaction model -> JSON editor, and drag/drop the "interactionmodel.json" file from the alexa/src directory, and click save.
- Under "Invocations" make sure you set an appropriate skill invocation name
- Go to Endpoint and set this to "HTTPS" and put the Alexa server component's API URL that is externally accessible, such as "https://groceries.mydomain.tld/alexa"

## Environment Variables for Alexa Server process

These are a subset of the same variables used for the main authentication server and include:
- COUCHDB_URL
- COUCHDB_INTERNAL_URL
- COUCHDB_DATABASE
- COUCHDB_HMAC_KEY
- COUCHDB_ADMIN_USER
- COUCHDB_ADMIN_PASSWORD
- LOG_LEVEL