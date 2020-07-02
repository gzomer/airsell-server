const DB = require('../db.js')
const atob = require('atob');
const PurchaseService = require('./purchase.js');
const AirtableService = require('./airtableService.js');
const fs = require('fs')
const slugify = require('slugify')

var _CACHE = JSON.parse(fs.readFileSync('./data/cacheOrders.json') || '{}')
var _CUSTOMERS_MAP = _CACHE._CUSTOMERS_MAP || {}
var _ORDERS_MAP = _CACHE._ORDERS_MAP || {}

class Ecommerce {

	airtableService = new AirtableService()

	constructor(ecommerceDomain) {
		this.ecommerceDomain = ecommerceDomain
	}

	async init() {
		this.ecommerce = await DB.models.Ecommerce.findOne({
			domain: this.ecommerceDomain
		})

		if (this.ecommerce == null) {
			throw new Error('Invalid ecommerce')
		}

		this.ecommerce.menus = this.getMenus()
		return this
	}


	getMenus() {
		let mapping = this.ecommerce.airtable.fieldsMappings.Products.fields.Category

		if (!mapping.options || !mapping.options.choices || !mapping.options.choices.length) {
			return []
		}

		let menus = mapping.options.choices.map(item => {
			return {
				link: '/products/category/' + slugify(item.name.toLowerCase()),
				name: item.name
			}
		})

		menus.unshift({
			link:'/',
			name: 'Home'
 		})

 		return menus;
	}

	convertSlugToCategory(slug) {
		let mapping = this.ecommerce.airtable.fieldsMappings.Products.fields.Category

		if (!mapping.options || !mapping.options.choices || !mapping.options.choices.length) {
			return null
		}

		let categories =  mapping.options.choices.filter(item => {
			return slugify(item.name.toLowerCase()) == slug
		})

		if (!categories.length) {
			return null
		}
		return categories[0].name
	}

	convertBasketToProductItems(basket) {
		if (!basket) {
			return []
		}

		let cartItems = JSON.parse(atob(basket))
		let products = this.getProducts()

		let productItems = cartItems.map(cartItem => {

			let filteredProducts = products.filter(product => cartItem.id == product.ID)
			if (filteredProducts.length > 0) {
				cartItem.product = filteredProducts[0]
			}
			return cartItem
		})
		.filter(item => item.product)
		.map(item => {
			item.totalPrice = item.product.Price * item.quantity
			return item
		})

		return productItems
	}

	addProductAttributes(product) {

		let attributes = []

		let attributesKeys = [ 'Attribute1','Attribute2','Attribute3', 'Attribute4', 'Attribute5']

		attributesKeys.map(key => {
			if (!this.ecommerce.airtable.fieldsMappings.Products.fields[key]) {
				return;
			}
			let fieldName = this.ecommerce.airtable.fieldsMappings.Products.fields[key].name

			if (product[key]) {
				attributes.push({
					name: fieldName,
					values: product[key].map(item => item.name)
				})
			}
		})

		product.attributes = attributes
		return product
	}

	getProductBySlug(productSlug) {
		let products = this.getProducts()
						  .filter(item => item.Slug == productSlug)

		if (!products || !products.length) {
			return null
		}
		return this.addProductAttributes(products[0])
	}

	getProducts() {
		return this.ecommerce.data.Products
	}

	getProductsByCategory(categorySlug) {
		let category = this.convertSlugToCategory(categorySlug);

		if (!category) {
			return {
				category:'',
				products: []
			}
		}
		return {
			category:category,
			products: this.ecommerce.data.Products.filter(item=>item.Category.name == category)
		}
	}

	getCustomerId(email) {
		return _CUSTOMERS_MAP[email]
	}

	getOrderId(cartId) {
		return _ORDERS_MAP[cartId]
	}

	saveCache() {
		fs.writeFileSync('./data/cacheOrders.json',JSON.stringify({
			_CUSTOMERS_MAP: _CUSTOMERS_MAP,
			_ORDERS_MAP: _ORDERS_MAP
		},null, 2))
	}

	async createCustomer(customer) {
		return this.airtableService.sendData({
			'table': 'Customers',
			'fields' : {
				'Name' : customer.name,
				'Email' : customer.email
			}
		}, this.ecommerce.airtable)
	}

	mapAttributes(row,values, fieldsMappings) {
		let attributesKeys = [ 'Attribute1','Attribute2','Attribute3', 'Attribute4', 'Attribute5']

		let attributesNamesMap = {}
		attributesKeys.map(function(key) {
			if (!fieldsMappings.Products.fields[key]) {
				return null
			}
			attributesNamesMap[fieldsMappings.Products.fields[key].name] = key
		})

		for (var attrKey in values) {
			row[attributesNamesMap[attrKey]] = [values[attrKey]]
		}
		return row
	}

	async createOrder(cartId, customer, address, productItems) {
		let orderId = this.getOrderId(cartId)

		if (orderId) {
			return {
				id: orderId,
				alreadyCreated: true
			}
		}

		let customerId = this.getCustomerId(customer.email)
		if (!customerId) {
			let airtableCustomer = await this.createCustomer(customer)
			customerId = airtableCustomer[0].id
			_CUSTOMERS_MAP[customer.email] = customerId
			this.saveCache()
		}

		if (!customerId) {
			return null
		}

		let totalPrice = parseFloat(productItems.map(item=>item.totalPrice).reduce((a,b)=> a+b,0).toFixed(2))

		let airtableOrders = await this.airtableService.sendData({
			'table': 'Orders',
			'fields' : {
				'Customer' : [customerId],
				'Price' : totalPrice,
				'Country' : address.country,
				'City' : address.city,
				'Address Line1' : address.line1,
				'Address Line2' : address.line2,
				'Postal Code' : address.postal_code,
			}
		}, this.ecommerce.airtable)

		if (!airtableOrders) {
			return null
		}

		// Cache for order ID
		let airtableOrder = airtableOrders[0]
		let orderIdField = this.ecommerce.airtable.fieldsMappings['Orders'].fields["Order ID"]
		orderId = airtableOrders[0].fields[orderIdField.name]
		_ORDERS_MAP[cartId] = orderId
		this.saveCache()

		let orderProducts = productItems.map(function(item) {
			let row = {
				'Order' : [airtableOrder.id],
				'Product' : [item.product.ID],
				'Quantity' : item.quantity,
				'Price' : item.product.Price
			}

			row = this.mapAttributes(row, item.attributes, this.ecommerce.airtable.fieldsMappings)
			return row
		}.bind(this))

		let airtableProductItems = await this.airtableService.sendData({
			'table': 'Order Products',
			'fields' : orderProducts
		}, this.ecommerce.airtable)


		return {
			id: orderId
		}
	}

	async verifyPurchaseAndSendOrder(id) {
		let purchaseService = new PurchaseService()
		let purchase = await purchaseService.getPurchaseInfo(id)

		if (!purchase || !purchase.intent) {
			return {
				"status": false,
				"message" : "Invalid purchase"
			}
		}
		if (purchase.intent.status != 'succeeded') {
			return {
				"status": false,
				"message" : "Your payment could not be completed."
			}
		}

		let customer = {
			email: purchase.customer.email,
			name: purchase.intent.shipping.name
		}

		let address = {
			city: purchase.intent.shipping.address.city,
			country: purchase.intent.shipping.address.country,
			line1: purchase.intent.shipping.address.line1,
			line2: purchase.intent.shipping.address.line2,
			postal_code: purchase.intent.shipping.address.postal_code,
		}

		let order = await this.createOrder(id, customer, address, purchase.productItems)

		if (!order){
			return {
				"status": false,
				"message" : "There was an error creating your order."
			}
		}

		let successMessage = "Thanks for your order!"

		if (customer.name) {
			successMessage = customer.name.split(' ')[0] + ", thanks for your order! <br> Save this page for your further reference."
		}

		return {
			status: true,
			message: successMessage,
			alreadyCreated: order.alreadyCreated,
			order : order,
			customer: customer,
			address: address,
			productItems: purchase.productItems
		}
	}
}

module.exports = Ecommerce