"use strict";

var _ = require('lodash');

var Dict = INCLUDE('dict');


exports.install = function () {
    F.route('/erp/api/dict', load_dict, ['authorize']);
    F.route('/erp/api/extrafield', load_extrafield, ['authorize']);
    F.route('/erp/api/sendEmail', sendEmail, ['post', 'json', 'authorize']);

    F.route('/erp/api/product/convert_price', function () {
        var ProductModel = MODEL('product').Schema;
        var PriceLevelModel = MODEL('pricelevel').Schema;

        if (this.query.type) {
            ProductModel.find({}, function (err, docs) {
                for (var i = 0, len = docs.length; i < len; i++) {
                    ProductModel.update({_id: docs[i]._id}, {'type': 'PRODUCT'}, function (err, doc) {
                        if (err)
                            console.log(err);
                    });
                }
            });
        }

        if (this.query.price) {
            ProductModel.find({}, function (err, docs) {
                for (var i = 0, len = docs.length; i < len; i++) {
                    ProductModel.update({_id: docs[i]._id}, {'prices.pu_ht': docs[i].pu_ht}, function (err, doc) {
                        if (err)
                            console.log(err);
                    });
                }
            });
        }
        if (this.query.pricelevel) {
            PriceLevelModel.find({}, function (err, docs) {
                for (var i = 0, len = docs.length; i < len; i++) {
                    PriceLevelModel.update({_id: docs[i]._id}, {'prices.pu_ht': docs[i].pu_ht}, function (err, doc) {
                        if (err)
                            console.log(err);
                    });
                }
            });
        }

        this.json({ok: true});
    }, ['authorize']);
    F.route('/erp/api/product/convert_tva', function () {
        DictModel.findOne({
            _id: "dict:fk_tva"
        }, function (err, docs) {
            for (var i in docs.values) {
                if (docs.values[i].label)
                    docs.values[i].value = docs.values[i].label;
                if (docs.values[i].label == null && docs.values[i].value == null)
                    docs.values[i].value = 0;
                delete docs.values[i].label;
                //console.log(docs.values[i]);
            }
            docs.save(function (err, doc) {
                //console.log(err);
                res.json(doc);
            });
        });
    }, ['authorize']);
    F.route('/erp/convert/{type}', convert, ['authorize']);

    // SHOW LAST 50 PROBLEMS
    F.route('/erp/errors/', function () {

        var self = this;
        self.json(F.problems);

    });

    F.route('#404', view_404);
    //F.route('#500', view_500);
};

function load_dict() {
    var self = this;

    Dict.dict(self.query, function (err, dict) {
        if (err)
            return self.throw500(err);

        self.json(dict);
    });
}

function load_extrafield() {
    var self = this;

    Dict.extrafield(self.query, function (err, extrafield) {
        if (err)
            return self.throw500(err);

        self.json(extrafield);
    });
}

function view_404() {
    console.log("Error 404 : not found", this.url);
    this.view('404');
}

function view_500() {
    this.view('500');
}

function sendEmail() {
    var self = this;

    //console.log(self.body);

    var mailOptions = self.body.message;

    if (self.body.data && self.body.data.url)
        self.body.data.url = self.host(self.body.data.url);

    if (self.body.data && !self.body.data.entity)
        self.body.data.entity = self.entity._id;

    //console.log(self.body);

    self.body.data.entity = self.body.data.entity.charAt(0).toUpperCase() + self.body.data.entity.slice(1);

    var dest = [];
    if (typeof self.body.to == 'object' && self.body.to.length)
        dest = _.pluck(self.body.to, 'email');
    else
        dest = self.body.to;

    if (!dest || !dest.length)
        return self.throw500('No destinataire');

    console.log(dest);

    //Send an email
    self.mail(dest, self.body.data.entity + " - " + self.body.data.title, self.body.ModelEmail, self.body.data);

    if (self.config['mail.address.copy'])
        self.mail(self.config['mail.address.copy'], self.entity.name + " - " + self.body.data.title, self.body.ModelEmail, self.body.data);

    self.json({
        successNotify: {
            title: "Mail envoye",
            message: self.body.to.length + " mail(s) envoye(s)"
        }
    });
}

function convert(type) {
    /**
     * Convert contact collection to new user schema extended for e-commerce
     */

    var self = this;
    var mongoose = require('mongoose');

    console.log(type);

    if (type == 'user') {
        var UserModel = MODEL('hr').Schema;

        mongoose.connection.db.collection('users', function (err, collection) {
            collection.find({_type: null}, function (err, users) {
                if (err)
                    return console.log(err);

                users.each(function (err, user) {

                    if (user == null)
                        return self.plain("Converted Users...");


                    user.username = user.name;
                    var id = user._id;
                    delete user._id;
                    delete user.name;

                    if (user.Status !== 'ENABLE')
                        delete user.password;

                    //console.log(user);

                    var newUser = new UserModel(user);
                    //console.log(newUser);
                    collection.deleteOne({_id: id}, function (err, results) {
                        if (err)
                            return console.log(err);

                        newUser.save(function (err, doc) {
                            if (err || !doc)
                                return console.log("Impossible de creer ", err);
                        });

                    });

                });

            });
        });

        return;
    }

    if (type == 'contact') {
        var UserModel = MODEL('contact').Schema;
        mongoose.connection.db.collection('users', function (err, collection) {
            collection.find({}, function (err, users) {
                users.each(function (err, user) {
                    if(user.societe && user.societe.id)
                        UserModel.update({_id:user._id}, {$set:{societe:user.societe.id}}, {upsert:false, multi:false}, function(err, result){
                            console.log(err, result);
                        });
                });
            });
        });
        
        return;

        mongoose.connection.db.collection('Contact', function (err, collection) {
            collection.find({}, function (err, contacts) {
                if (err)
                    return console.log(err);

                contacts.each(function (err, contact) {


                    if (contact == null)
                        return self.plain("Converted contacts...");

                    var id = contact._id;
                    if (!contact.email)
                        delete contact.email;

                    if (contact.Status == 'ST_ENABLE')
                        contact.Status = 'ENABLE';
                    else if (contact.Status == 'ST_DISABLE')
                        contact.Status = 'DISABLE';
                    else
                        contact.Status = 'NEVER';

                    //console.log(contact);

                    var newUser = new UserModel(contact);
                    //console.log(contact);

                    newUser.save(function (err, doc) {
                        if (err || !doc)
                            return console.log("Impossible de creer ", err)
                    });

                });
            });
            collection.remove(function (err) {
                if (err)
                    console.log(err);
            });
        });

        return;
    }

    return self.plain("Type is unknown");
}