# Printly

**Páginas inteiras em PDF, como você vê.**

Extensão open source para Google Chrome, com texto selecionável, cores,
links e carimbo opcional de data, hora e URL. Sem conta, sem servidor e sem
dependências de execução.

[English](README.en.md) · [Privacidade](PRIVACY.md) ·
[Como contribuir](CONTRIBUTING.md) · [Licença MIT](LICENSE)

## Recursos

- Captura conteúdo além da área visível usando o motor de impressão do Chrome.
- Preserva texto e vetores quando o conteúdo original permite.
- Emula CSS de tela para reduzir alterações causadas por `@media print`.
- Oferece largura real, folha contínua e A4, além de margens e escala.
- Percorre a página para carregar imagens sob demanda, com limites de espera.
- Pode fixar barras flutuantes para evitar que se repitam no PDF.
- Inclui data e hora com fuso, URL, título e numeração no cabeçalho ou rodapé.
- Captura pelo popup ou por **Ctrl + Shift + Y** (**⌘ + Shift + Y** no macOS).

## Instalação

Requer **Google Chrome 116 ou superior** em um computador. A extensão usa
Manifest V3 e é instalada manualmente a partir deste repositório.

1. No GitHub, clique em **Code → Download ZIP** e extraia o arquivo.
   Se preferir Git:

   ```sh
   git clone https://github.com/guir-ribeiro/printly.git
   ```

2. Abra `chrome://extensions` no Chrome.
3. Ative o **Modo do desenvolvedor**.
4. Clique em **Carregar sem compactação** e selecione a pasta extraída que
   contém `manifest.json`.
5. Fixe **Printly** na barra de extensões, se desejar.

**Não é necessário instalar Node.js, executar npm ou fazer build para usar.**
Para atualizar, substitua os arquivos ou execute `git pull`, volte a
`chrome://extensions` e clique em **Recarregar** na extensão.

## Uso

1. Abra a página e expanda o conteúdo que deseja incluir.
2. Clique no ícone da extensão e escolha as opções.
3. Clique em **Baixar PDF** e aguarde o início do download.
4. Confira a conclusão na lista de downloads do Chrome.

A captura continua se o popup fechar. As últimas opções também são usadas
pelo atalho. Configure-o em `chrome://extensions/shortcuts`, se necessário.
Durante o preparo, a página rola automaticamente; aguarde a conclusão antes
de continuar interagindo com ela.

### Formatos e opções

| Opção | Comportamento |
| --- | --- |
| **Largura real da página** — padrão | A largura da folha acompanha o conteúdo, com páginas de proporção próxima à A4. Busca reduzir a reorganização do layout. |
| **Página única contínua** | Uma folha longa. Acima de cerca de 195 polegadas de altura calculada, usa paginação. |
| **A4** | Retrato ou paisagem. A largura menor pode alterar o layout do site. |
| **Margens** | Nenhuma, pequenas ou normais. O carimbo pode acrescentar espaço vertical. |
| **Escala** | De 50% a 150%. |
| **Cores e imagens de fundo** | Inclui os fundos ao imprimir. |
| **Fixar barras flutuantes** | Tenta impedir a repetição de elementos `position: fixed`. |
| **Carimbo** | Cabeçalho ou rodapé com campos selecionáveis e espaço reservado fora do conteúdo. |
| **Perguntar onde salvar** | Abre o diálogo do Chrome para escolher o destino. |

O arquivo usa o título e a hora local da captura, por exemplo:
`Minha página - 2026-11-01 14h30.pdf`.

## Privacidade e permissões

O código da extensão não envia PDFs, URLs ou conteúdo de páginas a um
servidor, nem inclui analytics ou código remoto. Os PDFs são gerados no
navegador e salvos no destino escolhido no Chrome.

As preferências usam **`chrome.storage.sync`** e podem ser sincronizadas pela
Conta Google. A rolagem de preparo pode fazer o próprio site carregar imagens
e outros recursos pela rede. Veja os detalhes em [PRIVACY.md](PRIVACY.md).

| Permissão | Finalidade |
| --- | --- |
| `activeTab` | Acesso temporário à aba após uma ação do usuário. |
| `scripting` | Preparar o conteúdo e restaurar as alterações temporárias. |
| `debugger` | Chamar `Page.printToPDF` pelo Chrome DevTools Protocol. É uma permissão ampla; o código a utiliza durante a geração do PDF. |
| `downloads` | Iniciar o download e liberar a memória do PDF quando ele termina ou é interrompido. |
| `storage` | Salvar as preferências de captura. |
| `offscreen` | Criar a URL de um Blob para baixar o PDF no Manifest V3. |

O Chrome mostra um aviso de depuração durante a captura. Ele decorre do uso
de `chrome.debugger` e desaparece quando a conexão é encerrada.

## Limitações e solução de problemas

- **Páginas protegidas:** não captura `chrome://`, Chrome Web Store, DevTools
  e outras páginas reservadas pelo navegador.
- **DevTools aberto:** pode disputar a conexão de depuração; feche-o na aba
  e tente novamente.
- **Rolagem infinita:** há um limite de 90 etapas; feeds e páginas muito
  extensas podem continuar incompletos.
- **Listas virtualizadas e painéis com rolagem própria:** conteúdo fora do
  DOM ou dentro de áreas internas pode não ser incluído.
- **Vídeos, canvas e iframes:** o resultado depende do motor de impressão;
  conteúdo dinâmico, protegido ou de outros domínios pode sair incompleto.
- **Tamanho:** a largura considerada é limitada a 5.000 pixels; páginas e
  PDFs muito grandes podem exceder a memória ou limites do Chrome.
- **Fidelidade:** estilos, animações, fontes e a implementação do site podem
  causar diferenças. Compare o PDF com a página antes de usá-lo.
- **Outros navegadores:** navegadores Chromium podem funcionar, mas não há
  garantia. Não é uma extensão para Firefox, Safari ou navegadores móveis.

Se o problema persistir, [abra uma issue](https://github.com/guir-ribeiro/printly/issues/new/choose)
com a versão do Chrome, sistema, opções e passos para reproduzir.
Remova informações pessoais de URLs e capturas.

## Desenvolvimento

JavaScript, HTML e CSS sem framework ou compilação. Para as verificações de
desenvolvimento, use **Node.js 22 ou superior**:

```sh
npm run check
npm test
```

Não há pacotes para instalar. Os testes usam o runner nativo do Node.js e
simulam as APIs do Chrome; a validação visual deve ser feita no navegador.
Veja o roteiro em [CONTRIBUTING.md](CONTRIBUTING.md).

Para gerar um ZIP instalável em macOS ou Linux, com o comando `zip` disponível:

```sh
npm run package
```

O arquivo `printly-<versão>.zip` inclui apenas os arquivos de execução e a
licença. Extraia-o antes de usar **Carregar sem compactação**. O CI também
gera esse pacote como artefato; não publica releases nem envia à Web Store.

### Atualização do nome

A partir da versão 1.0.2, a extensão se chama **Printly**. Ao atualizar os
arquivos na mesma pasta e recarregar a extensão, as preferências existentes
são mantidas. O atalho de captura continua o mesmo.

### Estrutura e funcionamento

| Arquivo | Responsabilidade |
| --- | --- |
| `manifest.json` | Metadados, permissões, ícones e atalho. |
| `background.js` | Preparação, impressão, restauração e download. |
| `settings.js` | Valores padrão e validação das preferências. |
| `popup.html`, `popup.css`, `popup.js` | Interface de configuração e captura. |
| `offscreen.html`, `offscreen.js` | Conversão em Blob e liberação de URLs. |
| `tests/`, `scripts/` | Testes de regressão, verificação e empacotamento. |

O worker se conecta à aba com `chrome.debugger`, prepara imagens e fontes,
emula mídia `screen` e chama `Page.printToPDF`. Também tenta neutralizar
fundos com `background-clip: text` em elementos sem texto, um caso que pode
criar retângulos coloridos na impressão.

Após ler o PDF, ele remove a emulação, restaura estilos, atributos de mídia e
rolagem e desconecta o depurador, inclusive nos caminhos de erro. Um
documento offscreen reutilizável cria o Blob para download. A URL é revogada
ao concluir ou interromper o download, sem encerrar downloads paralelos.

Referências: [API debugger](https://developer.chrome.com/docs/extensions/reference/api/debugger),
[API offscreen](https://developer.chrome.com/docs/extensions/reference/api/offscreen)
e [Page.printToPDF](https://chromedevtools.github.io/devtools-protocol/tot/Page/#method-printToPDF).

## Contribuições e licença

Correções, melhorias de acessibilidade, documentação e relatos reproduzíveis
são bem-vindos. Leia [CONTRIBUTING.md](CONTRIBUTING.md) e o
[Código de Conduta](CODE_OF_CONDUCT.md). Para vulnerabilidades, use o canal
descrito em [SECURITY.md](SECURITY.md).

Distribuído sob a [licença MIT](LICENSE), copyright Guilherme Ribeiro.
Consulte o texto da licença para os termos de uso, modificação e distribuição.
