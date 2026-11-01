# Como contribuir

Aceitamos issues e pull requests em português ou inglês. Consulte as
[issues existentes](https://github.com/guir-ribeiro/pdf-fiel-extensao/issues)
e descreva mudanças grandes em uma issue antes de implementá-las.

## Ambiente

1. Faça um fork e clone seu repositório.
2. Crie uma branch: `git switch -c fix/descricao-curta`.
3. Carregue a pasta em `chrome://extensions`, no modo do desenvolvedor.
4. Com Node.js 22+, execute `npm run check` e `npm test`.

Não há dependências npm nem build. Recarregue a extensão no Chrome após
editar. Inspecione o worker pelo link em `chrome://extensions`; o DevTools
da página capturada pode interferir na conexão de depuração.

## Implementação

- Mantenha o código legível e sem dependências de execução quando possível.
- Use `settings.js` como fonte das preferências padrão e sua validação.
- Discuta novas permissões ou comunicação externa e atualize a privacidade.
- Restaure alterações temporárias na página também em caso de erro.
- Não registre conteúdo privado, tokens, cookies ou PDFs em logs e testes.
- Inclua testes de regressão para correções no fluxo de captura.
- Mantenha as duas versões do README coerentes.

## Verificação no navegador

Testes automatizados simulam as APIs e não comprovam fidelidade visual.
Para mudanças no fluxo, registre quais cenários verificou:

1. Página curta e longa; texto selecionável, fundos e imagens lazy.
2. Largura real, folha única e A4 nas duas orientações.
3. Carimbo no cabeçalho e rodapé, data com fuso e numeração.
4. Tema escuro, barras fixas, estilos, atributos e rolagem após a captura.
5. Falha na impressão: página restaurada e aviso de depuração encerrado.
6. Atalho, fechamento do popup e tentativa de capturas simultâneas.
7. Página protegida e aba com DevTools aberto.
8. Cancelamento de **Salvar como**, escolha após mais de 30 segundos e
   downloads consecutivos; confira conclusão e erros na lista do Chrome.

Use páginas sem informações pessoais. Não envie PDFs de clientes ou URLs privadas.

## Pull request

Explique problema, resultado, alteração e validação. Informe Chrome, sistema
e cenários nos testes de navegador; marque como não executado o que faltar.
O CI verifica sintaxe, testes e ZIP; não publica a extensão.

Contribuições são disponibilizadas sob a [licença MIT](LICENSE).
Siga o [Código de Conduta](CODE_OF_CONDUCT.md).
