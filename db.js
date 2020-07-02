const mongoose = require('mongoose');
const passportLocalMongoose = require('passport-local-mongoose');

var self = module.exports = {}
self.models = {}

const Schema = mongoose.Schema;
const UserSchema = new Schema({
  name: String,
  username: String,
  password: String
});

UserSchema.plugin(passportLocalMongoose);

const EcommerceSchema = new Schema({
  name: String,
  description: String,
  stripe: Object,
  logo: String,
  theme: String,
  domain: String,
  homeDescription: String,
  homeTitle: String,
  facebook: String,
  instagram: String,
  apiKey: String,
  airtable: Object,
  fieldsMapping : Object,
  data: Object,
});

self.models.User = mongoose.model('User', UserSchema, 'User');
self.models.Ecommerce = mongoose.model('Ecommerce', EcommerceSchema, 'Ecommerce');