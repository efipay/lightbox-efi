const catalog = document.getElementById('catalog');
const bodyTable = document.getElementById('bodyTable');
const buttonLightbox = document.querySelector('.buttonLightbox');
const display = document.querySelectorAll('.display');
const none = document.getElementById('none');
var CODE = '';
var SHIPPING = '--';
const cart = [];

const produtcs = $.getJSON("/assets/db/products.json");

$gn.ready(function (variable) {

    Swal.fire({
        title: 'LOJA APENAS PARA TESTE',
        text: "Esta loja é somente para testes e os pedidos não serão processados nem entregues.",
        icon: 'info',
    }
    )
    //  Criando o layout dos produtos
    produtcs.responseJSON.forEach(elem => {
        let article = document.createElement('article');
        article.classList.add('col-8', 'col-md-3', 'col-sm-5', 'mb-3'); // quando a tela diminuir ficar apenas 2 por linha

        let divCard = document.createElement('div');
        divCard.classList.add('card', 'rounded-top');

        let img = document.createElement('img');
        img.src = elem.img;
        img.classList.add('card-img-top', 'rounded-top');

        let divCardBody = document.createElement('div');
        divCardBody.classList.add('card-body');

        let titleProduct = document.createElement('h5');
        titleProduct.classList.add('card-title');
        titleProduct.innerHTML = elem.name;

        let priceProduct = document.createElement('h5');
        priceProduct.classList.add('card-text');
        priceProduct.innerHTML = 'R$ ' + elem.price.toFixed(2);

        let buttonProduct = document.createElement('button');
        buttonProduct.classList.add('btn', 'btn-outline-primary', 'float-end');
        buttonProduct.id = elem.name;
        buttonProduct.onclick = addToCart;
        buttonProduct.innerHTML = 'Carrinho';

        divCardBody.appendChild(titleProduct);
        divCardBody.appendChild(priceProduct);
        divCardBody.appendChild(buttonProduct);

        divCard.appendChild(img);
        divCard.appendChild(divCardBody);

        article.appendChild(divCard)
        catalog.appendChild(article);
    });

    function addToCart(event) {
        //  Pegando o id do produto
        let idProduct = event.target.id;

        //  Encontrando o produto e verificando se ele ja está no carrinho
        let product = produtcs.responseJSON.find(elem => elem.name === idProduct);
        let addProduct = cart.find(elem => elem.name === product.name);

        //  Adiciona o produto caso ainda não tenha ou aumenta sua quantidade
        if (addProduct === undefined) {
            product.display = true;
            cart.push({
                ...product,
                amount: 1
            })
        } else {
            if (addProduct.amount + 1 < addProduct.availableQuantity) {
                addProduct.amount++;
            }
        }

        Swal.fire(
            'Adicionado ao carrinho com sucesso!',
            `${product.name} adicionado ao carrinho`,
            'success'
        )

        addProductsCart();

    }

    function addProductsCart(cep = '') {
        bodyTable.innerHTML = '';

        cart.forEach(product => {
            if (product.display) {
                let rowTable = document.createElement('tr');
                let columnProduct = document.createElement('td');
                let columnProductName = document.createElement('span');
                let columnPrice = document.createElement('td');
                let columnQuantity = document.createElement('td');
                let inputQuantity = document.createElement('input');
                let columnTotal = document.createElement('td');


                columnProductName.innerHTML = product.name.substring(0, 10);
                columnProductName.title = product.name;

                columnProduct.appendChild(columnProductName);

                columnPrice.innerHTML = 'R$ ' + Number(product.price).toFixed(2);

                inputQuantity.value = product.amount;
                inputQuantity.id = product.name;
                inputQuantity.type = "number";
                inputQuantity.min = 0;
                inputQuantity.max = product.availableQuantity;

                inputQuantity.onblur = updateQuantity;
                columnQuantity.appendChild(inputQuantity);
                columnTotal.innerHTML = 'R$ ' + Number(product.price * product.amount).toFixed(2);

                rowTable.appendChild(columnProduct);
                rowTable.appendChild(columnPrice);
                rowTable.appendChild(columnQuantity);
                rowTable.appendChild(columnTotal);
                bodyTable.appendChild(rowTable);
            }
        })

        if (cart.length > 0) {
            let rowShipping = document.createElement('tr');
            let columnTextShipping = document.createElement('td');
            let columnTdInputShipping = document.createElement('td');
            let columnInputShipping = document.createElement('input');
            let columnValueShipping = document.createElement('td');


            columnTextShipping.innerHTML = 'Frete:';
            columnTdInputShipping.colSpan = 2;
            columnInputShipping.type = "text";
            columnInputShipping.value = cep;
            columnInputShipping.placeholder = "CEP de entrega";
            columnInputShipping.maxLength = 9;
            columnInputShipping.onkeypress = eventMask;
            columnInputShipping.id = 'shippingInput'


            columnInputShipping.onkeyup = (event) => {
                if (event.target.value.length === 9) {
                    calculateShipping(event);
                }
            };

            columnValueShipping.innerHTML = SHIPPING === '--' ? SHIPPING : 'R$ ' + SHIPPING.toFixed(2);

            rowShipping.appendChild(columnTextShipping);
            columnTdInputShipping.appendChild(columnInputShipping);
            rowShipping.appendChild(columnTdInputShipping);
            rowShipping.appendChild(columnValueShipping);

            let rowTotal = document.createElement('tr');
            let columnTextTotal = document.createElement('td');
            let columnValueTotal = document.createElement('td');

            let total = cart.reduce((acc, cur) => {
                return acc + (Number(cur.price) * Number(cur.amount));
            }, 0);

            columnTextTotal.colSpan = 3;
            columnTextTotal.innerHTML = 'Total:'
            if (typeof (SHIPPING) === 'number') {
                columnValueTotal.innerHTML = 'R$ ' + (total + SHIPPING).toFixed(2);
            } else {
                columnValueTotal.innerHTML = 'R$ ' + SHIPPING;
            }
            rowTotal.appendChild(columnTextTotal);
            rowTotal.appendChild(columnValueTotal);

            bodyTable.appendChild(rowShipping);
            bodyTable.appendChild(rowTotal);


            display.forEach(elem => {
                elem.classList.remove('d-none');
            })
            none.innerHTML = '';
        } else {
            display.forEach(elem => {
                elem.classList.add('d-none');
            })
            none.innerHTML = 'Nenhum produto selecionado';
        }

    }

    function eventMask(event) {
        generateMask(event.target, '#####-###')
    }

    function generateMask(text, mask) {
        let i = text.value.length;
        let exit = mask.substring(1, 0);
        let newText = mask.substring(i)
        if (newText.substring(0, 1) != exit) {
            text.value += newText.substring(0, 1);
        }
    }

    function calculateShipping(event) {
        let cep = event.target.value;
        CODE = cep;

        if (cep.length > 0) {
            cep = cep.replace('-', '');

            // Descomente a função de acordo com seu Backend
            function calcularFrete(codeDestination) {
  const url = ``; // Caminho no Backend para calcular o frete, ex: https://minha.url/frete/${codeDestination}

  return fetch(url)
      .then(response => {
          return response.json();
      }).catch(error => {
          console.log(error);
          return error;
      }
      );
}
            // Função para calcular o frete com backend em NodeJS
            // function calcularFrete(codeDestination) {
            //     const url = ``; // Caminho no Backend para calcular o frete, ex: https://minha.url/frete/${codeDestination}

            //     return fetch(url)
            //         .then(response => {
            //             return response.json();
            //         }).catch(error => {
            //             console.log(error);
            //             return error;
            //         }
            //         );
            // }
            // calcularFrete(cep).then((result) => {
            //     if (result.error == "") {
            //         SHIPPING = Number(result.value.replace(',', '.'));
            //         addProductsCart(cep);
            //         buttonLightbox.disabled = false;
            //         buttonLightbox.classList.remove('disabled')

            //         var payment_forms = ["pix", "banking_billet", "credit_card"];
            //         variable.lightbox(payment_forms);


            //     } else {
            //         Swal.fire({
            //             icon: 'error',
            //             title: 'Oops...',
            //             text: result.error_message,
            //         })
            //         event.target.value = '';
            //         CODE = '';
            //         SHIPPING = '--';
            //         addProductsCart();
            //     }
            // })

            // Função para calcular o frete com backend em PHP
            // $.post('./assets/utils/calculateShipping.php', cep, function (resultado) {
            //     resultado = JSON.parse(resultado);
            //     if (Number(resultado.erros) === 0) {
            //         SHIPPING = Number(resultado.preco.replace(',', '.'));
            //         addProductsCart(cep);
            //         buttonLightbox.disabled = false;
            //         buttonLightbox.classList.remove('disabled')

            //         /*
            //         *   Definição dos meios de pagamento
            //         */
            //         var payment_forms = ["pix", "banking_billet", "credit_card"];
            //         variable.lightbox(payment_forms);


            //     } else {
            //         Swal.fire({
            //             icon: 'error',
            //             title: 'Oops...',
            //             text: resultado.msgErro,
            //         })
            //         event.target.value = '';
            //         CODE = '';
            //         SHIPPING = '--';
            //         addProductsCart();
            //     }

            // });


        }

    }

    function updateQuantity(event) {

        let value = event.target.value;
        let idProduct = event.target.id;
        let product = cart.find(elem => elem.name === idProduct);

        if (value <= 0) {
            cart.splice(cart.indexOf(product), 1);
        } else if (value > product.availableQuantity) {
            product.amount = product.availableQuantity;
        } else {
            product.amount = value;
        }

        addProductsCart(CODE);
    }

    buttonLightbox.addEventListener('click', function (evt) {

        if (SHIPPING === '--') {
            Swal.fire({
                icon: 'error',
                title: 'Oops...',
                text: 'Informe o CEP de entrega',
            })
            return
        }

        var data = {
            items: [],
            shippingCosts: SHIPPING === '--' ? 0 : Number(SHIPPING * 100),
            actionForm: '' // Local onde será enviada os dados para criação da cobrança URL da aplicação NodeJS ou endereço do arquivo PHP
        };

        data.items = cart.map((item) => {
            return {
                code: item.code,
                name: item.name,
                value: Number((item.price * 100).toFixed(0)),
                amount: item.amount
            }

        })

        variable.show(data);

    })
});