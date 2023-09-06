<?php

/**
 * Iniciação da SDK
 */
require_once __DIR__ . '/vendor/autoload.php';

use Efi\Exception\EfiException;
use Efi\EfiPay;

/**
 * Definição das credenciais
 */
function getEfiOptions(): array
{
    return [
        "client_id" => "Client_Id_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        "client_secret" => "Client_Secret_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        "pix_cert" => "./certs/developmentCertificate.pem",
        "pix_key" => "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
        "sandbox" => true, // true = Homologação | false = Produção
        "debug" => false,
        "timeout" => 30
    ];
}

/**
 * Obter os dados do pedido recebidos por POST
 */
function getOrderData(): array
{
    // Captura os dados enviados pelo frontend do Lightbox
    $bodyParams = json_decode(file_get_contents('php://input'), true);

    $postItens = $bodyParams['items'] ?? [];
    $postShipping = $bodyParams['shippingCosts'] ?? 0;
    $postCustomer = $bodyParams['customer'] ?? [];
    $postShippingAddress = $bodyParams['shippingAddress'] ?? [];
    $postPayment = $bodyParams['payment'] ?? [];

    return compact('postItens', 'postShipping', 'postCustomer', 'postShippingAddress', 'postPayment');
}

/**
 * Obter a lista de produtos a partir de um arquivo JSON
 */
function getAllProducts(): array
{
    $json = file_get_contents("./db/products.json");
    return json_decode($json, true);
}

/**
 * Calcular o valor total dos itens do pedido
 */
function calculateTotalValue(array $items, array $products): int
{
    $totalValue = 0;

    foreach ($items as $item) {
        foreach ($products as $product) {
            if ($product['code'] === $item['code']) {
                $totalValue += (float) (($product['price'] * 100) * $item['amount']);
                break;
            }
        }
    }

    return $totalValue;
}

/**
 * Mapear itens para emitr cobrança de boleto e cartão
 */
function getProductsList(array $items, array $products): array
{
    foreach ($items as $item) {
        $mappedProduct = [
            'name' => $item['name'],
            'amount' => (int) $item['amount']
        ];

        foreach ($products as $product) {
            if ($product['code'] === $item['code']) {
                $mappedProduct['value'] = $product['price'] * 100;
                break;
            }
        }
    }
    $listMappedProducts[] = $mappedProduct;

    return $listMappedProducts;
}

/**
 * Cria a cobrança Pix
 */
function createPixCharge(object $apiInstance, array $data): array
{
    $body = [
        "calendario" => [
            "expiracao" => ((int) $data['expirationTime'] * 86400) // Expiração definida em segundos
        ],
        "valor" => [
            "original" => number_format(($data['totalValue'] + $data['shippingCosts']) / 100, 2, '.', '')
        ],
        "chave" => $data['pixKey'], // Chave pix da conta Efí do recebedor
        "infoAdicionais" => [
            [
                "nome" => "Produtos",
                "valor" => "Valor total: " . number_format($data['totalValue'] / 100, 2, ',', '.')
            ],
            [
                "nome" => "Frete",
                "valor" => "Valor: " . number_format($data['shippingCosts'] / 100, 2, ',', '.')
            ]
        ]
    ];

    if ($data['customer']['person'] === 'juridical') {
        $body['devedor'] = [
            'nome' => $data['customer']['corporate_name'],
            'cnpj' => $data['customer']['cnpj']
        ];
    } else {
        $body['devedor'] = [
            'nome' => $data['customer']['name'],
            'cpf' => $data['customer']['cpf']
        ];
    }

    try {
        $pixResponse = $apiInstance->pixCreateImmediateCharge([], $body);

        return $pixResponse;
    } catch (EfiException $e) {
        header("HTTP/1.1 400");
        echo json_encode(
            [
                'data' => json_encode([
                    'code' => $e->code,
                    'error' => $e->error,
                    'error_description' => $e->errorDescription
                ])
            ]
        );
    } catch (Exception $e) {
        header("HTTP/1.1 400");
        echo json_encode(
            [
                'data' => json_encode([
                    'code' => 400,
                    'error_description' => $e->getMessage()
                ])
            ]
        );
    }
}

/**
 * Gera o QRCode da cobrança Pix
 */
function generatePixQRCode(object $apiInstance, int $locId): array
{
    $params = [
        'id' => $locId
    ];

    try {
        $qrResponse = $apiInstance->pixGenerateQRCode($params);

        return $qrResponse;
    } catch (EfiException $e) {
        header("HTTP/1.1 400");
        echo json_encode(
            [
                'data' => json_encode([
                    'code' => $e->code,
                    'error' => $e->error,
                    'error_description' => $e->errorDescription
                ])
            ]
        );
    } catch (Exception $e) {
        header("HTTP/1.1 400");
        echo json_encode(
            [
                'data' => json_encode([
                    'code' => 400,
                    'error_description' => $e->getMessage()
                ])
            ]
        );
    }
}

/**
 * Cria a cobrança de Boleto ou Cartão
 */
function createBilletOrCardCharge(object $apiInstance, array $data): array
{
    $shippings = [
        [
            'name' => 'Frete',
            'value' => $data['shippingCosts']
        ]
    ];

    $customer = [
        'name' => $data['customer']['name'],
        'email' => $data['customer']['email'],
        'cpf' => $data['customer']['cpf'],
        'birth' => $data['customer']['birth'],
        'phone_number' => $data['customer']['phone']
    ];

    if ($data['customer']['person'] === 'juridical') {
        $customer['juridical_person'] = [
            'corporate_name' => $data['customer']['corporate_name'],
            'cnpj' => $data['customer']['cnpj']
        ];
    }

    if (!empty($data['shippingAddress'])) {
        $shippingAddress = [
            'street' => $data['shippingAddress']['street'],
            'number' => $data['shippingAddress']['number'],
            'neighborhood' => $data['shippingAddress']['neighborhood'],
            'city' => $data['shippingAddress']['city'],
            'state' => $data['shippingAddress']['state'],
            'zipcode' => $data['shippingAddress']['zipcode']
        ];

        if (isset($data['shippingAddress']['complement'])) {
            $shippingAddress['complement'] = $data['shippingAddress']['complement'];
        }

        $customer['address'] = $shippingAddress;
    }

    $payment = [];
    if ($data['payment']['method'] === 'credit_card') {
        $billingAddress = [
            'street' => $data['payment']['address']['street'],
            'number' => $data['payment']['address']['number'],
            'neighborhood' => $data['payment']['address']['neighborhood'],
            'city' => $data['payment']['address']['city'],
            'state' => $data['payment']['address']['state'],
            'zipcode' => $data['payment']['address']['zipcode']
        ];

        if (isset($data['payment']['address']['complement'])) {
            $billingAddress['complement'] = $data['payment']['address']['complement'];
        }

        $payment['credit_card'] = [
            'installments' => (int)$data['payment']['installments'],
            'billing_address' => $billingAddress,
            'payment_token' => $data['payment']['payment_token'],
            'customer' => $customer
        ];
    } else {
        $expire = new DateTime();
        $expire->add(new DateInterval("P{$data['expirationTime']}D"));

        $payment['banking_billet'] = [
            'expire_at' => $expire->format('Y-m-d'),
            'customer' => $customer
        ];
    }

    $chargeBody = [
        'items' => $data['items'],
        'shippings' => $shippings,
        'payment' => $payment
    ];


    try {
        $response = $apiInstance->createOneStepCharge([], $chargeBody);

        return $response;
    } catch (EfiException $e) {
        header("HTTP/1.1 400");
        echo json_encode(
            [
                'data' => json_encode([
                    'code' => $e->code,
                    'error' => $e->error,
                    'error_description' => $e->errorDescription
                ])
            ]
        );
    } catch (Exception $e) {
        header("HTTP/1.1 400");
        echo json_encode(
            [
                'data' => json_encode([
                    'code' => 400,
                    'error_description' => $e->getMessage()
                ])
            ]
        );
    }
}

try {
    $options = getEfiOptions();
    $orderData = getOrderData();
    $products = getAllProducts();

    if ($orderData['postPayment']['method'] == 'pix') {
        $apiInstance = EfiPay::getInstance($options);

        $totalValue = calculateTotalValue($orderData['postItens'], $products);

        $pix = createPixCharge($apiInstance, [
            'expirationTime' => 5,
            'totalValue' => $totalValue,
            'shippingCosts' => $orderData['postShipping'],
            'pixKey' => $options['pix_key'],
            'customer' => $orderData['postCustomer']
        ]);

        if ($pix['txid']) {
            $qrcode = generatePixQRCode($apiInstance, $pix['loc']['id']);

            $returnPix = [
                "data" => [
                    "pix" => $pix,
                    "qrcode" => $qrcode
                ]
            ];

            header("HTTP/1.1 200");
            echo json_encode($returnPix);
        } else {
            header("HTTP/1.1 200");
            echo json_encode(['data' => $pix]);
        }
    } else { // Se for cobrança de boleto ou cartão
        $apiInstance = new EfiPay($options);
        $productsList = getProductsList($orderData['postItens'], $products);

        $response = createBilletOrCardCharge($apiInstance, [
            'items' => $productsList,
            'shippingCosts' => $orderData['postShipping'],
            'customer' => $orderData['postCustomer'],
            'shippingAddress' => $orderData['postShippingAddress'],
            'payment' => $orderData['postPayment'],
            'expirationTime' => 5 // 5 dias de vencimento para Boleto e Pix
        ]);

        header("HTTP/1.1 200");
        echo json_encode(['data' => $response['data']]);
    }
} catch (EfiException $e) {
    header("HTTP/1.1 400");
    echo json_encode(
        [
            'data' => json_encode([
                'code' => $e->code,
                'error' => $e->error,
                'error_description' => $e->errorDescription
            ])
        ]
    );
} catch (Exception $e) {
    header("HTTP/1.1 400");
    echo json_encode(
        [
            'data' => json_encode([
                'code' => 400,
                'error_description' => $e->getMessage()
            ])
        ]
    );
}
