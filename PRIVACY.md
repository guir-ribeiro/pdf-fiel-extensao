# Privacidade

Esta política descreve o código deste repositório. Forks e outras
redistribuições podem alterar seu comportamento.

## Dados processados

- **Conteúdo da aba:** processado no navegador após o usuário clicar em
  capturar ou usar o atalho, para preparar e imprimir a página.
- **Título, URL, data e hora:** usados no nome do arquivo e no carimbo,
  conforme as opções. A URL pode incluir parâmetros ou tokens presentes
  na barra de endereço.
- **Preferências:** formato, orientação, escala, margens, fundos, barras,
  campos do carimbo e opção de destino são salvos em `chrome.storage.sync`.
  Podem ser sincronizados pelo Chrome e pela Conta Google, conforme as
  configurações do usuário. Não são enviados ao mantenedor.
- **PDF:** fica em memória durante geração e download. Sua URL de Blob é
  liberada ao concluir, interromper ou falhar ao iniciar o download.
  O arquivo baixado permanece no destino escolhido no Chrome.

Não há conta do projeto, analytics, publicidade, servidor de captura,
scripts remotos ou envio de PDFs pelo código da extensão.

## Rede e serviços externos

A extensão não implementa chamadas de rede próprias. A página visitada pode
carregar imagens, fontes, iframes ou conteúdo por rolagem. O preparo pode
disparar essas requisições; o navegador e o site podem continuar online.

Sincronização de preferências, verificações de downloads e destinos são
controlados pelo navegador e pelas configurações da conta. Escolher uma
pasta sincronizada por outro aplicativo pode enviar o PDF por esse aplicativo.

## Permissões

Não há `host_permissions`, content scripts permanentes ou mensagens externas.
`activeTab` e `scripting` preparam a aba após uma ação do usuário. A permissão
ampla `debugger` permite acessar o protocolo de depuração; nesta implementação,
é usada para imprimir a aba e a conexão é encerrada antes do download.

`downloads` inicia e acompanha os arquivos; `storage` guarda preferências;
`offscreen` mantém um documento local para criar e revogar URLs de Blob.
Esse documento pode ser reutilizado entre capturas e não exibe conteúdo ao usuário.

## Controle do usuário

Você pode desativar o carimbo, retirar o campo de URL e escolher onde salvar.
Revise os PDFs antes de compartilhar: eles podem conter conteúdo privado ou
acessível apenas em uma sessão autenticada.

Remover a extensão apaga suas preferências no Chrome. Apague PDFs baixados
separadamente, inclusive em pastas sincronizadas e lixeiras.
Para relatar exposição de dados, consulte [SECURITY.md](SECURITY.md).
