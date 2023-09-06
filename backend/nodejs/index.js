const express = require('express');
const fs = require('fs');
const cors = require('cors');
const https = require('https');
const logger = require('morgan');
const EfiPay = require('sdk-node-apis-efi');
const Correios = require('node-correios');

const options = {
  sandbox: true,
  client_id: 'Client_Id_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  client_secret: 'Client_Secret_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  certificate: '../certs/developmentCertificate.pem'
};

const pixKey = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx";

const expirationTime = 5 // Tempo de expiração do pagamento em dias

const products = JSON.parse(fs.readFileSync('../db/products.json')); // Carrega os produtos cadastrados no arquivo products.json no banco de dados

const httpsOptions = {
  cert: fs.readFileSync('./certs/fullchain.pem'), // Certificado fullchain do dominio
  key: fs.readFileSync('./certs/privkey.pem'), // Chave privada do domínio
  ca: fs.readFileSync('./certs/chain-pix-prod.crt'), // Certificado público da efipay
  minVersion: 'TLSv1.2',
  requestCert: false,
  rejectUnauthorized: false //Mantenha como false para que os demais endpoints da API não rejeitem requisições sem MTLS
};

const app = express();
const httpsServer = https.createServer(httpsOptions, app);
const PORT = 443;

app.use(logger('dev')); // Comente essa linha caso não queira que seja exibido o log do servidor no seu console
app.use(express.json());
app.use(cors());
app.use(express.urlencoded({ extended: false }));

app.get('/frete/:cep', (req, resp) => {
  const { cep } = req.params

  const correios = new Correios();

  packageInfos = {
    nCdServico: '04014',
    sCepOrigem: '35400000',
    sCepDestino: cep,
    nVlPeso: '1',
    nCdFormato: 1,
    nVlComprimento: 16,
    nVlAltura: 2,
    nVlLargura: 11,
    nVlDiametro: 0,
  }

  correios.calcPreco(packageInfos).then(result => {

    objectResponse = {
      value: result[0].Valor,
      error: result[0].Erro,
      error_message: result[0].MsgErro
    }
    
    resp.status(200).send(jsonResponse)

  })
})

app.post('/', async (req, resp) => {
  const { body } = req
  const { items } = body
  const { customer } = body
  const { shippingAddress } = body
  const { payment } = body
  const { shippingCosts } = body
  
  function mountCustomerObjectToAPI(customer, api){
    if(api === "pix"){
      return customer.person === "natural" ? { 
        cpf: customer.cpf, 
        nome: customer.name, 
      } : { 
        cnpj: customer.cnpj, 
        nome: customer.name, 
      }
    } 
    else if (api === "banking_billet" || api === "credit_card"){
      return customer.person === "natural" ? {
        cpf: customer.cpf, 
        name: customer.name, 
        email: customer.email, 
        phone_number: customer.phone, 
        address: shippingAddress, 
        birth: customer.birth } : { 
        juridical_person: { 
          corporate_name: customer.corporate_name,
          cnpj: customer.cnpj ,
        }, 
        cpf: customer.cpf, 
        name: customer.name, 
        email: customer.email, 
        phone_number: customer.phone, 
        address: shippingAddress, 
        birth: customer.birth ,
      }
    }
  }

  function addDaysToDate(days) {
    const currentDate = new Date();
    currentDate.setDate(currentDate.getDate() + days);
  
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const day = String(currentDate.getDate()).padStart(2, '0');
  
    const formattedDate = `${year}-${month}-${day}`;
    return formattedDate;
  }
  
  const efipay = new EfiPay(options);

  items.forEach(item => {

    const product = products.find(produt => produt.code === item.code)

    if (product) {
      item.name = product.name
      item.price = product.price * 100
    } else {
      item.name = "Produto não encontrado"
      item.price = 0
    }

  })
  if (payment.method === "pix") {

    valorTotal = (items.reduce((total, item) => total + item.price, 0) + shippingCosts) / 100

    try {
      const body = {
        calendario: {
          expiracao: expirationTime * 86400 // 5 dias (passado em segundos)
        },
        devedor: mountCustomerObjectToAPI(customer, payment.method),
        valor: {
          original: valorTotal.toFixed(2)
        },
        chave: pixKey,
      }


      let pix
      await efipay.pixCreateImmediateCharge([], body)
        .then(response => {
          pix = response
        })
        .catch(err => {
          pix = response
        })
      if (pix && pix.txid) {
        try {
          const qr = await efipay.pixGenerateQRCode({
            id: pix.loc.id
          })

          resp.status(200).send(JSON.stringify(
            {
              "data": {
                pix: pix,
                qrcode: qr,
              }
            }
          ))
        } catch {
          resp.status(400).send(JSON.stringify({
            "data": JSON.stringify({
              "code": 400,
              "error": "Erro ao gerar cobrança Pix",
              "error_description": JSON.stringify(err)
            })
          }))
        }
      }
    }
    catch (err) {
    }
  }
  else if (payment.method === "banking_billet") {
    await efipay.createOneStepCharge([], {
      items: (items.map(item => { return { name: item.name, value: item.price, amount: item.quantity } })),
      payment: {
        banking_billet: {
          expire_at: addDaysToDate(expirationTime),
          customer: mountCustomerObjectToAPI(customer, payment.method),
        }
      },
      shippings: [{
        name: 'Default Shipping Cost',
        value: shippingCosts
      }]
    })
      .then(response => {
        resp.status(200).send(JSON.stringify({
          "data": response.data
        }))
      })
      .catch(err => {
        resp.status(400).send(JSON.stringify({
          "data": JSON.stringify({
            "code": 400,
            "error": "Erro ao gerar cobrança",
            "error_description": JSON.stringify(err)
          })
        }))
      })
  }
  else if (payment.method === "credit_card") {
    await efipay.createOneStepCharge([], {
      items: (items.map(item => { return { name: item.name, value: item.price, amount: item.quantity } })),
      payment: {
        credit_card: {
          customer: mountCustomerObjectToAPI(customer, payment.method),
          installments: parseInt(payment.installments),
          payment_token: payment.payment_token,
          billing_address: shippingAddress
        }
      },
      shippings: [{
        name: 'Default Shipping Cost',
        value: shippingCosts
      }]
    })
      .then(response => {
        resp.status(200).send(JSON.stringify({
          "data": response.data
        }))
      })
      .catch(err => {
        resp.status(400).send(JSON.stringify({
          "data": JSON.stringify({
            "code": 400,
            "error": "Erro ao gerar cobrança",
            "error_description": JSON.stringify(err)
          })
        }))
      })
  }
})


httpsServer.listen(PORT, () => console.log(`Express server currently running on port ${PORT}`));