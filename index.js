const express = require("express");

// create express application instance
const app = express();
const https = require("https");
const redis = require("redis");
const bodyParser = require("body-parser");
const cors = require("cors");
// create and connect redis client to local instance.
let client = redis.createClient();
app.use(express.urlencoded());
app.use(express.json());
app.use(cors());

const PRODUCTSSKUS = require("./productsSku");

var allowCrossDomain = function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  res.header(
    "Access-Control-Allow-Methods",
    "GET,PUT,POST,DELETE,PATCH,OPTIONS"
  );
  next();
};
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

app.post("/get_products", function(req, res, next) {
  const productsIds = req.body.ids;
  const offset = req.body.offset;
  const limit = req.body.limit;
  const productsRedisKey = "products";
  const ProductSkuCopy = PRODUCTSSKUS.slice(0);
  const ProductSkuFilter = ProductSkuCopy.splice(offset, limit + offset);

  function fetch_retry(url) {
    let request = https
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
    request.end();
  }

  if (ProductSkuFilter.length) {
    url =
      "https://simple.ripley.cl/api/v2/products?partNumbers=" +
      ProductSkuFilter.toString();

    const perc = Math.random(0) * 100;
    if (perc > 10) {
      fetch_retry(url);
    } else {
      res.status(500).json({ error: "Problema interno" });
    }
  } else {
    res.status(200).json({});
  }
});

app.listen(8080, () => {
  console.log("El servidor está inicializado en el puerto 3000");
});
