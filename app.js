const express = require('express')
const app = express()
const port = 4040
const swig = require('swig')
const cors = require('cors')
const passport = require('passport');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const ensureLogin = require('connect-ensure-login')
const DB = require('./db.js')
const routes = require('./routes.js')
const session = require('express-session')
const cookieParser = require('cookie-parser')
const RedisStore = require('connect-redis')(session);
const redis = require('redis')
const redisClient = redis.createClient({
    host: '127.0.0.1',
    port: 6379,
    prefix: 'lms_',
})

const Ecommerce = require('./services/ecommerce')

mongoose.connect('mongodb://localhost:27017/airsell', { useNewUrlParser: true, useUnifiedTopology: true });

const expressSession = session({
  secret: 'YVYivrs8n4',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 3600*24*30*1000},
  key:'connect.sid',
  //store: new RedisStore(redisClient)
});

passport.use(DB.models.User.createStrategy());

passport.serializeUser(DB.models.User.serializeUser());
passport.deserializeUser(DB.models.User.deserializeUser());

app.use(expressSession);
app.use(passport.initialize());
app.use(passport.session());

app.use(cors())
app.use(cookieParser())
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.engine('html', swig.renderFile);
app.set('view engine', 'html');
app.set('views', __dirname + '/views');
app.use(express.static('public'))

app.use(routes)

app.listen(port, () => console.log(`Listening at http://localhost:${port}`))