const ensureLogin = require('connect-ensure-login')
const router = require('express').Router()
const Publish = require('./services/publish')
const Ecommerce = require('./services/ecommerce')
const PurchaseService = require('./services/purchase')
const publish = new Publish()

router.use(function(req, res, next) {
	if (req.subdomains && req.subdomains.length) {
		req.ecommerceDomain = req.subdomains[0]
	}
	next()
})

router.get('/',
	wrapAsync(async (req, res, next) => {
		let data = []
		let ecommerce = await new Ecommerce(req.ecommerceDomain).init()
		data = ecommerce.getProducts()

		res.render('pagelist', {
			ecommerce: ecommerce.ecommerce,
			page: {
				title: ecommerce.ecommerce.homeTitle || ecommerce.ecommerce.name,
				description: ecommerce.ecommerce.homeDescription || ecommerce.ecommerce.description
			},
			breadcrumbs: [
			],
			items: data.map(item=>{
				return {
					url : '/products/' + item.Slug,
					name: item.Name,
					image: item.Images?item.Images[0].url:null,
					description: item.Description
				}
			})
		})
	}))


router.get('/products/category/:category',
	wrapAsync(async (req, res, next) => {
		let data = []
		let ecommerce = await new Ecommerce(req.ecommerceDomain).init()
		data = ecommerce.getProductsByCategory(req.params.category)

		res.render('pagelist', {
			ecommerce: ecommerce.ecommerce,
			page: {
				title: data.category,
				description: ''
			},
			breadcrumbs: [
			],
			items: data.products.map(item=>{
				return {
					url : '/products/' + item.Slug,
					name: item.Name,
					image: item.Images?item.Images[0].url:null,
					description: item.Description
				}
			})
		})
	}))

router.get('/products/:product',
	wrapAsync(async (req, res, next) => {
		let ecommerce = await new Ecommerce(req.ecommerceDomain).init()
		let product = ecommerce.getProductBySlug(req.params.product)

		let attachments = product.Attachments

		res.render('product', {
			ecommerce: ecommerce.ecommerce,
			page: {
				title: product.Name,
				description: product.Description
			},
			breadcrumbs: [
				{
					name: 'Home',
					url :'/'
				},
				{
					name : product.Name
				}
			],
			product: product,
		})
	}))

router.get('/cart',
	wrapAsync(async (req, res, next) => {
		let ecommerce = await new Ecommerce(req.ecommerceDomain).init()

		let productItems = ecommerce.convertBasketToProductItems(req.cookies.basket)
		let totalPrice = productItems.map(item=>item.totalPrice).reduce((a,b)=> a+b,0)

		res.render('cart', {
			ecommerce: ecommerce.ecommerce,
			page: {
				title: 'Your Cart',
				description: ''
			},
			breadcrumbs: [
			],
			totalPrice: totalPrice.toFixed(2),
			items: productItems.map(item=>{
				return {
					url : '/products/' + item.product.Slug,
					name: item.product.Name,
					quantity: item.quantity,
					attributes: Object.keys(item.attributes).map(function(key) {
					  return {name:key, value:item.attributes[key]};
					}),
					totalPrice : item.totalPrice.toFixed(2),
					description: item.product.Description
				}
			})
		})
	}))


router.post('/publish', wrapAsync(async (req, res, next) => {
	let data = await publish.publish(req.body)
	res.json(data)
}))

router.get('/order/:id', wrapAsync(async(req, res, next) => {
	let ecommerce = await new Ecommerce(req.ecommerceDomain).init()

	let order = await ecommerce.verifyPurchaseAndSendOrder(req.params.id)
	let totalPrice = order.productItems.map(item=>item.totalPrice).reduce((a,b)=> a+b,0)

	if(!order.alreadyCreated) {
		res.cookie("basket", "", { expires: new Date(0), path: '/' });
	}
	res.render('order', {
		ecommerce: ecommerce.ecommerce,
		page: {
			title: order.status? "Order #" + order.order.id : "Ops, we have a problem",
			description: order.message
		},
		breadcrumbs: [
		],
		totalPrice: totalPrice.toFixed(2),
		order: order,
		items: order.productItems.map(item=>{
			return {
				url : '/products/' + item.product.Slug,
				name: item.product.Name,
				quantity: item.quantity,
				attributes: Object.keys(item.attributes).map(function(key) {
					  return {name:key, value:item.attributes[key]};
				}),
				totalPrice : item.totalPrice.toFixed(2),
				description: item.product.Description
			}
		})
	})
}))


router.post('/purchase/session', wrapAsync(async(req, res, next) => {
	let ecommerce = await new Ecommerce(req.ecommerceDomain).init()

	let productItems = ecommerce.convertBasketToProductItems(req.cookies.basket)
	let totalPrice = productItems.map(item=>item.totalPrice).reduce((a,b)=> a+b,0)

    new PurchaseService()
    .createSession(req.body, productItems)
    .then(session => res.json({session: session.id}))
    .catch(err => next(err));
}))

function wrapAsync(fn) {
  return function(req, res, next) {
    // Make sure to `.catch()` any errors and pass them along to the `next()`
    // middleware in the chain, in this case the error handler.
    fn(req, res, next).catch(next);
  };
}

router.use(async function(error, req, res, next) {
  let ecommerce = null
  try {
  	ecommerce = await new Ecommerce(req.ecommerceDomain).init()
  } catch (e) {
  	res.status(422).render('error', {
      ecommerce: {
      	name:'AirSell',
      	theme:'United'
      },
      page: {
        title: "Ops, there was an error",
        description: error.message
      }
    })
    return
  }


  if (req.headers && req.headers.accept && req.headers.accept.indexOf('application/json') != -1) {
    res.status(422).json({ message: error.message });
  } else {
    res.status(422).render('error', {
      ecommerce: ecommerce.ecommerce,
      page: {
        title: "Ops, there was an error",
        description: error.message
      }
    })
  }
});
module.exports = router