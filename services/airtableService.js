const Airtable = require('airtable');

class Base {

	constructor(apiKey, baseId) {
		this.apiKey = apiKey;
		this.baseId = baseId;
		this.base = new Airtable({apiKey: this.apiKey}).base(this.baseId);
	}

	getRecordByField(table, field, value) {

	}

	createRecord(table, fields) {
		return new Promise(function(resolve, reject){
			let params = {}
			if (fields instanceof Array) {
				params = fields
			} else {
				params = [
				  {
				    "fields": fields
				  }
				]
			}
			this.base(table).create(params, function(err, records) {
			  if (err) {
			    reject(err)
			    return;
			  }

			  resolve(records)
			});
		}.bind(this))
	}
}

class AirtableService {

	convertFieldsToAirtable(table, data, mappings) {
		let fields = {}
		//console.log(data, table)
		for (var key in data) {
			if (!mappings[table].fields[key]) {
				continue
			}
			fields[mappings[table].fields[key].fieldId] = data[key]
		}

		return fields
	}
	sendData(data, config) {
		let base = new Base(config.apiKey, config.base);

		let tableId = config.fieldsMappings[data.table].table

		let mappings = config.fieldsMappings
		let fields = {}

		// Convert to airtable IDS
		if (data.fields instanceof Array) {
			fields = data.fields.map(function(item){
				return {
					'fields': this.convertFieldsToAirtable(data.table, item, mappings)
				}
			}.bind(this))
		}
		else {
			fields = this.convertFieldsToAirtable(data.table, data.fields, mappings)
		}

		return base.createRecord(tableId, fields);
	}
}


module.exports = AirtableService