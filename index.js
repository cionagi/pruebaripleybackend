const express = require("express");

// create express application instance
const app = express();
const https = require("https");
var redis = require("redis");
var bodyParser = require("body-parser");
// create and connect redis client to local instance.
var client = redis.createClient();
app.use(express.urlencoded());
app.use(express.json());




var allowCrossDomain = function(req, res, next) {
  res.header('Access-Control-Allow-Origin', 'localhost:3001');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
}
app.use(allowCrossDomain);


client.on("error", err => {
  console.log("Error " + err);
});

app.post("/get_product_by_id", function(req, res) {
  const productId = req.body.id;
  // client.del(productId)

  client.exists(productId.toString(), function(err, reply) {
    if (reply === 1) {
      client.get(productId, function(err, reply) {
        res.status(200).json(JSON.parse(reply));
      });
    } else {
      const url =
        "https://simple.ripley.cl/api/v2/products/by-id/" +
        productId.toString();
      https
        .get(url, resp => {
          let data = "";
          resp.on("data", chunk => {
            data += chunk;
          });
          resp.on("end", () => {
            const product = JSON.parse(data);
            console.log("doesn't exist", product.uniqueID);

            client.set(product.uniqueID.toString(), JSON.stringify(product));

            res.status(200).json(product);
          });
        })
        .on("error", err => {
          console.log("Error: " + err.message);
        });
    }
  });

  // }
  // });
});

app.post("/get_products", function(req, res) {
  console.log("Params: ", req.body.ids);
  const productsIds = req.body.ids;
  const productsRedisKey = "products";

  // client.get(productsRedisKey, (err, products) => {
  //   console.log(products.toString());
  // });

  if (productsIds !== undefined) {
    url =
      "https://simple.ripley.cl/api/v2/products?partNumbers=" +
      productsIds.toString();

    https
      .get(url, resp => {
        let data = "";
        resp.on("data", chunk => {
          data += chunk;
        });

        resp.on("end", () => {
          let productList;
          JSON.parse(data).map(product => {
            const {
              uniqueID,
              partNumber,
              name,
              images,
              prices,
              shortDescription
            } = product;
            productList = {
              ...productList,
              [uniqueID]: {
                uniqueID,
                partNumber,
                name,
                images,
                prices,
                shortDescription
              }
            };
          });
          client.set(productsRedisKey, productList.toString());
          res.status(200).json(productList);
        });
      })
      .on("error", err => {
        console.log("Error: " + err.message);
      });
  } else {
    res.status(500).json({ error: "Debe enviar los sku" });
  }
});

app.listen(3001, () => {
  console.log("El servidor está inicializado en el puerto 3000");
});
