# Carregar e editar ficheiros - DUnAs - Repositório de Dados de Investigação da Universidade de Aveiro
## Nesta Página

![](https://dkou0skpxpnwz.cloudfront.net/accounts/130855/images/bw5_1.jpg)

  * [FORMATOS DE FICHEIRO](https://uapt.libguides.com/dunas/carregar-e-editar-ficheiros#s-lg-box-wrapper-18789218)

  * [NOMEAÇÃO DOS FICHEIROS](https://uapt.libguides.com/dunas/carregar-e-editar-ficheiros#s-lg-box-wrapper-19561997)

  * [CARREGAR FICHEIROS NO DUNAS](https://uapt.libguides.com/dunas/carregar-e-editar-ficheiros#s-lg-box-wrapper-19561998)

  * [CONTACTOS E HELPDESK](https://uapt.libguides.com/dunas/carregar-e-editar-ficheiros#s-lg-box-wrapper-19561987)

  * [CONTEÚDOS DE APOIO](https://uapt.libguides.com/dunas/carregar-e-editar-ficheiros#s-lg-box-wrapper-19561988)

## Formatos de ficheiro

Existem diferentes tipos de dados de acordo com a área científica, que são
obtidos, processados e armazenados de diversas formas e formatos.

Ao criar um plano de gestão de dados, umas das principais
decisões/considerações a ter são que formatos de arquivo utilizar. Esta
escolha é crucial e deverá assegurar que os dados sejam legíveis no futuro.
Alguns formatos têm maior probabilidade de permitirem a sua legibilidade no
futuro do que outros.  

**Formatos proprietários vs. formatos abertos**

Sempre que possível é preferencial guardar os dados num formato aberto, não
proprietário. Formatos abertos ou não proprietários são preferenciais, pois
existem menos possibilidades de problemas ao processá-los futuramente. Mas, se
converter os dados para um formato aberto resultar em perda de dados nos
arquivos, deve considerar-se guardar os dados nos dois formatos para
salvaguardar futuramente que se o formato proprietário não for lido, pelo
menos se consegue aceder a alguns dados/informação através do formato aberto.
Quando for necessário guardar ficheiros num formato proprietário, deve
considerar-se incluir um ficheiro readme.txt no diretório, que contenha as
informações do nome e a versão do software usado, assim como a empresa que o
criou. Esta informação poderá ser útil no futuro em caso de necessidade de
descobrir como ler esses ficheiros.

Muitos dados encontram-se em formatos de arquivo compactados, o que foi útil
na simplificação do processamento, mas não é um fator positivo para a
interoperabilidade dos dados. O formato que deverá ser utilizado para
armazenamento e preservação a longo prazo é o formato criado inicialmente na
captura dos dados, isto é, o formato de arquivo padrão sem perda direta (dados
brutos). O uso de formatos padrão ou amplamente adotados tornará os dados mais
interoperáveis.

**Diretrizes para escolha de formatos**

Os formatos de arquivo devem ser, preferencialmente:

  1. Formatos não proprietários 

  2. Formatos abertos documentados por padrões internacionais 

  3. Não encriptados ou codificados; ou que usem codificação de caracteres padrão, preferencialmente Unicode (por exemplo UTF-8) 

  4. Não comprimidos (se houver espaço) 

  5. De uso comum pela comunidade de investigação 

Referência bibliográfica: Stanford Libraries. (n.d.). Data best practices and
case studies. <https://guides.library.stanford.edu/data-best-practices/format-
files>

  
Existem formatos de arquivo considerados preferenciais e outros não
preferenciais. A adoção de um formato, ou conversão do formato original para
um outro considerado preferencial deve ser analisada particularmente.

Mais informações sobre formatos preferenciais e não preferenciais em:

  * Regulamento Nacional de Interoperabilidade Digital (RNID): <https://dre.pt/application/file/a/114461891>

  * DataverseNO: <https://site.uit.no/dataverseno/deposit/prepare/#what-are-preferred-file-formats>

  * DANS – Data Archiving and Networked Services: <https://dans.knaw.nl/en/file-formats/>

## Nomeação dos ficheiros

Boas práticas de nomeação de ficheiros:

  * Criar nomes significativos e curtos; 

  * Evitar a utilização de espaços e caracteres especiais; 

  * Não utilizar nomes genéricos que possam entrar em conflito, quando lhes é alterada a localização; 

  * O nome do ficheiro deverá incluir informação descritiva que auxiliará na sua identificação, independentemente do sítio onde é armazenado; 

  * Usar linha (_) em alternativa aos pontos finais (.) ou espaços; 

  * Se incluir datas fazê-lo de forma consistente (mais comum: AAAA-MM-DD ou AAAA-MM ou AAAA-AAAA), pois auxilia na ordenação cronológica; 

  * Ter em atenção o uso de maiúsculas, pois os sistemas podem assumir informações diferentes. 

## Carregar ficheiros no DUnAs

**Método de upload**

O carregamento de ficheiros no DUnAs é efetuado via HTTP através da interface.
Caso haja necessidade de utilizar outro método de upload, o depositante deverá
entrar em contacto com o [helpdesk do repositório](mailto:sbidm-dunas@ua.pt).

**Limite de upload**

O tamanho máximo de upload através da interface do repositório é de 5 GB por
ficheiro. O upload de ficheiros com um tamanho superior é mediado pelo serviço
de gestão e helpdesk do DUnAs, pelo que o depositante deverá entrar em
contacto com o [helpdesk do repositório](mailto:sbidm-dunas@ua.pt).

**Metadados dos ficheiros**

O repositório disponibiliza também alguns campos de metadados ao nível dos
ficheiros e específicos para a descrição de cada um deles: ‘Nome do Ficheiro’,
‘Localização do Ficheiro’ e ‘Descrição’.

É também possível associar etiquetas/tags a cada ficheiro, como por exemplo:
Dados, Documentação, Código, etc.

**Ficheiro README**

É uma boa prática a associação ao dataset de um ficheiro em formato .txt
(README.txt) com informação que permita a interpretação e a reutilização dos
dados.  
Exemplos de modelos de ficheiros README:

  * <https://cornell.app.box.com/v/ReadmeTemplate>
  * <https://edatos.consorciomadrono.es/resources/txt/readme-en.txt>
  * <https://site.uit.no/dataverseno/deposit/prepare/#readmefile>

**Níveis de acesso aos ficheiros**

O repositório DUnAs contempla quatro níveis de acesso aos ficheiros
depositados:

**Aberto** – ficheiro disponibilizado em Acesso Aberto

**Embargado** – ficheiro em Acesso Restrito até uma determinada data

**Restrito** – ficheiro em Acesso Restrito com possibilidade de efetuar pedido
de acesso

**Fechado** – ficheiro em Acesso Restrito sem possibilidade de efetuar pedido
de acesso

Por defeito, todos os ficheiros carregados no repositório ficam disponíveis em
Acesso Aberto. No entanto, é possível restringir o acesso aos ficheiros que
contenham dados que por alguma razão não possam estar publicamente acessíveis,
sendo essa uma responsabilidade do depositante. Quando um dataset contempla
ficheiros restritos, é possível ativar a funcionalidade de pedido de acesso
(opção ‘Permitir o pedido de acesso’).

**URL privado**

O repositório disponibiliza uma funcionalidade que permite criar um URL
privado para acesso a um determinado dataset, possibilitando a partilha do
mesmo (por exemplo com editores e revisores de uma revista) antes deste ser
publicado. Qualquer utilizador que receba este URL conseguirá aceder ao
dataset e respetivos ficheiros sem ser necessário fazer login no repositório.

É possível criar um URL privado simples ou um com acesso anonimizado (para
casos de datasets associados a artigos com revisão por pares duplamente cega),
em que são escondidos os seguintes campos: author, datasetContact,
contributor, depositor, grantNumber, publication.

+info: [Private URL to Review Unpublished
Dataset](https://guides.dataverse.org/en/5.11.1/user/dataset-
management.html#private-url-to-review-unpublished-dataset)

## Contactos e Helpdesk

E-mail: [sbidm-dunas@ua.pt](mailto:sbidm-dunas@ua.pt)  
Tel.: (351) 234 247 149 | Ext.: 22304

**DUnAs - Repositório de Dados de Investigação da Universidade de Aveiro**  
[https://dunas.ua.pt ](https://dunas.ua.pt)

Serviços de Biblioteca, Informação Documental e Museologia  
Universidade de Aveiro  
Campus Universitário de Santiago  
3810-193 Aveiro - Portugal

## Conteúdos de apoio

**Páginas Web:**

  * [DUnAs](https://www.ua.pt/pt/sbidm/dunas)
  * [Gestão de dados de investigação](https://www.ua.pt/pt/sbidm/dados-de-investigacao)
  * [Ciência aberta](https://www.ua.pt/pt/sbidm/ciencia-aberta)

**Guias temáticos:**

  * [Gestão de dados de investigação](https://uapt.libguides.com/gdi)
  * [Planos de Gestão de Dados](https://uapt.libguides.com/pgd)

**Manuais e tutoriais:**

  * [Dataverse User Guide](https://guides.dataverse.org/en/5.11.1/user/)

  * [Manual do administrador de coleção do DUnAs](https://uapt.libguides.com/ld.php?content_id=35610204)

**Apresentações:**

  * [Criar planos de gestão de dados de investigação](https://uapt.libguides.com/ld.php?content_id=35610342)

  * [Criação de planos de gestão de dados com a ferramenta ARGOS](https://uapt.libguides.com/ld.php?content_id=35610317)

  * [A gestão de dados de investigação e o uso do DUnAs](https://uapt.libguides.com/ld.php?content_id=35610361)

[formação para pivots]

[Image designed by Freepik](https://br.freepik.com/)

This work is licensed under [CC BY 4.0 ![](https://chooser-
beta.creativecommons.org/img/cc-logo.f0ab4ebe.svg)![](https://chooser-
beta.creativecommons.org/img/cc-
by.21b728bb.svg)](https://creativecommons.org/licenses/by/4.0/?ref=chooser-v1)

  * [<< **Anterior:** Criar um dataset](https://uapt.libguides.com/dunas/criar-dataset)
  * [ **Seguinte:** Definir termos de uso e licenças >>](https://uapt.libguides.com/dunas/definir-termos-de-uso-e-licencas)



------------------------------

Para saber mais sobre Carregar e editar ficheiros - DUnAs - Repositório de Dados de Investigação da Universidade de Aveiro, aceda a https://uapt.libguides.com/dunas/carregar-e-editar-ficheiros