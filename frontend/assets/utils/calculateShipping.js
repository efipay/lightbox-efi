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

// Defina a função globalmente, para que possa ser acessada de outros arquivos
window.calcularFrete = calcularFrete;
