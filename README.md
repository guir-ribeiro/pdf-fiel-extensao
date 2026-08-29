# PDF Fiel — página inteira

Extensão do Chrome (Manifest V3) que baixa a página aberta em PDF, o mais
parecido possível com o que aparece na tela.


## Privacidade e segurança

- **Não faz nenhuma chamada de rede.** Não existe `fetch`, `XMLHttpRequest`
  nem `WebSocket` em nenhum arquivo — nada do que você captura sai do seu
  computador.
- **Não coleta dados.** As únicas informações salvas são as suas próprias
  preferências de captura (formato, margens, carimbo), guardadas localmente
  via `chrome.storage.sync` — sincronizadas pela sua própria Conta Google,
  como qualquer configuração de extensão, e nunca enviadas a mim.
- **Código 100% legível**, sem minificação nem ofuscação — todo o
  `background.js`, `popup.js` e `offscreen.js` está aqui, dá pra ler linha a
  linha antes de instalar.
- A permissão mais chamativa é `debugger`: é ela quem faz o Chrome mostrar a
  barra *"está depurando este navegador"* durante a captura. Não tem como
  evitar — é a única API que dá acesso ao motor de impressão do Chrome, e é
  usada só no instante do clique (ou atalho), nunca em segundo plano.

## Instalar

1. Abra `chrome://extensions`
2. Ligue o **Modo do desenvolvedor** (canto superior direito)
3. Clique em **Carregar sem compactação** e escolha esta pasta
4. Fixe o ícone na barra (opcional) e use `Cmd/Ctrl + Shift + Y` para capturar
   direto, sem abrir o popup

## Como ela consegue ser fiel

Em vez de tirar um print da tela e colar num PDF, ela chama o **próprio motor de
impressão do Chrome** (`Page.printToPDF`, via a API `chrome.debugger`). O
resultado é um PDF de verdade: texto selecionável e pesquisável, vetores,
links.

Quatro cuidados fazem a diferença em relação ao "Imprimir → Salvar em PDF"
padrão do navegador:

| Problema do print normal | O que a extensão faz |
| --- | --- |
| O site aplica `@media print` e some com menus, imagens e cores | Emula a mídia **`screen`**, então valem as mesmas regras CSS da tela — e o tema claro/escuro que você está vendo é preservado |
| O conteúdo reflui para a largura de um A4 e sites responsivos caem no layout mobile | O papel recebe a **largura real do conteúdo** (modo padrão), então nada é reorganizado |
| Imagens com `loading="lazy"` saem em branco | Percorre a página inteira antes de imprimir para disparar o lazy-load, e espera fontes e imagens terminarem |
| Barras `position: fixed` se repetem ou tapam conteúdo em toda página | Congela os elementos fixos na posição em que aparecem no topo |
| Fundos com `background-clip: text` em elementos sem texto viram um bloco colorido que não existe na tela | Neutraliza o fundo desses elementos antes de imprimir |

Também pede ao Chrome um PDF *tagged* com sumário a partir dos títulos, quando a
versão do navegador suportar.

## Opções

**Formato do papel**

- **Largura real da página** *(padrão)* — largura idêntica à do site, paginado
  em folhas de proporção A4. É o mais fiel.
- **Página única contínua** — tudo numa folha só, sem quebras. Ótimo para
  arquivar; ruim para imprimir. Acima de ~195 in de altura o PDF volta a ser
  paginado automaticamente (limite do formato).
- **A4** — para imprimir em papel de verdade. Aceita retrato ou paisagem.

**Margens**, **escala** (50%–150%), **imprimir cores e fundos** e **fixar barras
flutuantes** completam o controle de layout.

**Carimbo de data, hora e URL** (opcional, ligado por padrão)

Vai no rodapé ou no cabeçalho, e você escolhe o que entra: data e hora com
fuso, URL, título da página e numeração `página/total`. Quando ligado, reserva
uma faixa de ~1 cm **fora** da área do conteúdo, então ele nunca cobre nada da
página.

O nome do arquivo já sai como `Título da página - 2026-08-28 22h40.pdf`.

## Limites conhecidos

- Enquanto captura, o Chrome mostra a barra *"… está depurando este navegador"*.
  É inevitável: é o preço de usar `chrome.debugger`, que é a única forma de uma
  extensão chamar o motor de impressão. A barra some ao final.
- Não funciona em páginas protegidas (`chrome://`, Chrome Web Store, DevTools).
- Se o DevTools estiver aberto na aba, feche antes — só um depurador por aba.
- Sites com rolagem infinita são percorridos até um teto de segurança, não até
  o fim do infinito.
- Vídeos e `<canvas>` saem no quadro em que estavam.

## Nota sobre `background-clip: text`

Um `background: linear-gradient(...)` combinado com `background-clip: text`
recorta o fundo na forma das letras. Se o elemento **não tem texto nenhum**
(por exemplo, um `<div class="logo">` que hoje só contém uma `<img>`, mas
manteve o CSS de quando o logo era texto), na tela o gradiente é recortado
contra nada e some — mas o motor de impressão do Chrome ignora o recorte e
pinta o retângulo inteiro. O resultado é um bloco colorido atrás do logo, só
no PDF.

A extensão detecta e neutraliza esse caso. Ainda assim, vale limpar o CSS
morto no site: o gradiente nesses elementos não faz nada de útil.

## Arquivos

- `manifest.json` — permissões, atalho, ícones
- `background.js` — todo o fluxo: prepara a página, imprime, salva
- `popup.html` / `popup.css` / `popup.js` — as opções
- `offscreen.html` / `offscreen.js` — só existe porque o service worker do MV3
  não tem `URL.createObjectURL`; é ele quem cria o blob que o download usa
