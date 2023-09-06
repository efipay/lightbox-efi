<?php

$codeDestination = http_build_query($_POST);
$url = "http://ws.correios.com.br/calculador/CalcPrecoPrazo.aspx?nCdEmpresa=&sDsSenha=&sCdAvisoRecebimento=n&sCdMaoPropria=n&nVlValorDeclarado=0&nVlDiametro=0&StrRetorno=xml&nIndicaCalculo=3&nCdFormato=1&sCepOrigem=35400000&nVlPeso=1&nVlComprimento=15&nVlAltura=15&nVlLargura=15&nCdServico=04014&sCepDestino=" . $codeDestination;


$url = rtrim($url, "={");


$unparsedResult = file_get_contents($url);
$parsedResult = simplexml_load_string($unparsedResult);

$return = array(
    'preco' => strval($parsedResult->cServico->Valor),
    'prazo' => strval($parsedResult->cServico->PrazoEntrega),
    'erros' => strval($parsedResult->cServico->Erro),
    'msgErro' =>strval($parsedResult->cServico->MsgErro)
    
);
die(json_encode($return));

?>