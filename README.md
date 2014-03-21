#Safari docJs

[Safari Extension Reference](https://developer.apple.com/library/safari/documentation/UserExperience/Reference/SafariExtensionsReference/_index.html)  から Class構造とjsDocを生成するもの。

Class Reference には Constants の型が書いてないが、実際は数値定数しかないので全てNumber固定。

##build

<code>node main.js</code>

###IntelliJ IDEA

1. Prefereces -> JavaScript -> Libraries -> Configure 
2. Libraries (Global Libraries) -> [+] -> JavaScript 
3. .../Safari-docJs/build/safari.js -> OK 
4. Check -> OK 

### eclipse

しらない。