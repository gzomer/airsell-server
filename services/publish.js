const DB = require('../db.js')
const crypto = require('crypto')


class Publish {

	async publish(data) {

		let hasCreated = false
		let ecommerce = null;

		let existingDomain =  await DB.models.Ecommerce.findOne({
			domain: data.domain
		})

		if (typeof data.apiKey != 'undefined' && data.apiKey != null && data.apiKey != '') {
			ecommerce = await DB.models.Ecommerce.findOne({
				apiKey: data.apiKey
			})

			if (existingDomain && existingDomain.id != ecommerce.id) {
				return {
					success: false,
					message: 'This domain is already in use.'
				}
			}

			if (ecommerce == null) {
				return {
					success: false,
					message: 'Invalid ecommerce'
				}
			}
		} else {
			if (existingDomain) {
				return {
					success: false,
					message: 'This domain is already in use.'
				}
			}
			hasCreated = true
			ecommerce = await this.createEmptyEcommerce()
		}

		ecommerce.name = data.name
		ecommerce.description = data.description
		ecommerce.theme = data.theme
		ecommerce.domain = data.domain
		ecommerce.airtable = data.airtable
		ecommerce.fieldsMapping  = data.fieldsMapping
		ecommerce.homeDescription = data.homeDescription
		ecommerce.homeTitle = data.homeTitle
		ecommerce.instagram = data.instagram
		ecommerce.facebook = data.facebook
		ecommerce.stripe = data.stripe
		ecommerce.data = data.data

		ecommerce.markModified('data');
		ecommerce.markModified('stripe');
		ecommerce.markModified('fieldsMapping');
		ecommerce.markModified('airtable');

		await ecommerce.save()

		if (hasCreated) {
			return {
				success: true,
				apiKey: ecommerce.apiKey
			}
		}
		return {
			success: true
		}
	}

	async createEmptyEcommerce() {

		const apiKey = crypto.randomBytes(32).toString('hex');

		let ecommerce = await DB.models.Ecommerce.create({
			apiKey: apiKey
		})

		return ecommerce
	}
}


module.exports = Publish