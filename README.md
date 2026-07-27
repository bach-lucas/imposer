# Imposer

O Imposer é um assistente de referência para jogos, com um modo overlay para consulta durante a partida.

## Por que este aplicativo existe?

Jogos como Elden Ring exigem consultas frequentes a mapas, guias, PDFs e informações de itens. Em um computador com apenas um monitor, consultar esse material normalmente significa usar `Alt + Tab`, interromper a experiência e correr o risco de perder o controle do personagem.

O Imposer existe para manter o contexto disponível sem tirar o jogador do jogo.

O aplicativo será capaz de:

- abrir guias em PDF;
- consultar informações do Elden Ring;
- organizar conteúdos por jogo;
- abrir um modo overlay sobre a partida;
- permitir que os cliques passem para o jogo quando o modo protegido estiver ativo.

## Situação atual

O projeto está na primeira etapa do MVP:

- aplicativo Windows baseado em Tauri;
- interface em React e TypeScript;
- Parcel como ferramenta de desenvolvimento da interface;
- workspace inicial do Elden Ring;
- importação e visualização de PDF;
- controle inicial de opacidade;
- estrutura de atalho `Ctrl + F8`;
- configuração de ícones e empacotamento para Windows.

Ainda estamos implementando a integração nativa do overlay, o clique através e a persistência dos documentos.

## Próximas etapas

1. Transformar a janela de conteúdo em overlay real.
2. Fazer `Ctrl + F8` funcionar como atalho global.
3. Implementar o modo de clique protegido.
4. Salvar PDFs e configurações localmente.
5. Criar o catálogo inicial de itens do Elden Ring.

## Desenvolvimento

Requisitos:

- Windows;
- Node.js;
- Rust e Cargo;
- WebView2.

Executar a interface desktop:

```powershell
npm.cmd run tauri:dev
```

Validar o build da interface:

```powershell
npm.cmd run build
```
