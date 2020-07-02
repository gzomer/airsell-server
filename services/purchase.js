var _STRIPE_KEY = 'sk_test_lpXyLIGuLQhJRCRcV6wJiVeA';

var stripe = require("stripe")(_STRIPE_KEY);
var fs = require("fs");

var _CACHE = JSON.parse(fs.readFileSync('./data/cachePurchase.json') || '{}')
var _SESSIONS_MAP = _CACHE._SESSIONS_MAP || {}
var _BASKET_MAP = _CACHE._BASKET_MAP || {}
var _ORDER_MAP = _CACHE._ORDER_MAP || {}

var id = _CACHE.id || 1000

class Purchase {
   charge(token, email, plan) {

   	var planMap = {
   		Basic : 900,
   		Premium : 3900,
   		Professional : 4900
   	}

   	var price = planMap[plan];

   	return stripe.charges.create({
   	  amount: price,
   	  currency: 'usd',
   	  description: 'Logo - ' + plan + ' Package ',
   	  source: token,
   	});
   }

   async getPurchaseInfo(id){
      let session = await this.getSessionById(id)

      let paymentIntent = await stripe.paymentIntents.retrieve(
        session.payment_intent);

      let customer = await stripe.customers.retrieve(
        session.customer);

      let productItems = this.getBasketForSession(id)

      return {
        productItems: productItems,
        session: session,
        intent: paymentIntent,
        customer: customer
      }
   }

   saveCache() {
    fs.writeFileSync('./data/cache.json',JSON.stringify({
      _SESSIONS_MAP: _SESSIONS_MAP,
      _BASKET_MAP: _BASKET_MAP,
      _ORDER_MAP: _ORDER_MAP,
      id: id
    },null, 2))
   }

   getBasketForSession(id) {
    return _BASKET_MAP[id]
   }

   getSessionById(id) {
      return new Promise((resolve, reject) => {
          var session = _SESSIONS_MAP[id]

          stripe.checkout.sessions.retrieve(
            session,
            function(err, session) {
              resolve(session)
            }
          );
      })
   }

   convertPriceToStripFormat(price) {
      return parseFloat(price.toFixed(2))*100
   }

   convertProductItemsToLineItems(productItems) {
      return productItems.map(item => {
        let images = []

        if (item.product.Images) {
          images.push(item.product.Images[0].url)
        }

        let description = []
        for (let key in item.attributes) {
          description.push(key+ ': ' + item.attributes[key])
        }
        return {
           name: item.product.Name,
           description: description.join(' '),
           images: images,
           amount: this.convertPriceToStripFormat(item.product.Price),
           currency: 'usd',
           quantity: item.quantity
        }
      })
   }

   async createSession(urls, productItems) {
     _BASKET_MAP[id] = productItems

     const session = await stripe.checkout.sessions.create({
       payment_method_types: ['card'],
       line_items: this.convertProductItemsToLineItems(productItems),
       shipping_address_collection:{
        allowed_countries:['US','GB']
       },
       success_url: urls.successURL + id,
       cancel_url: urls.cancelURL,
     });

     _SESSIONS_MAP[id] = session.id
     id++;

     this.saveCache()
     return session;
   }
}

module.exports = Purchase;