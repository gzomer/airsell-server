const DB = require('../db.js')
const crypto = require('crypto')


class Publish {

	async publish(data) {

		let hasCreated = false
		let ecommerce = null;

		if (typeof data.apiKey != 'undefined' && data.apiKey != null && data.apiKey != '') {
			ecommerce = await DB.models.Ecommerce.findOne({
				apiKey: data.apiKey
			})

			if (ecommerce == null) {
				throw new Error('Invalid ecommerce')
			}
		} else {
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