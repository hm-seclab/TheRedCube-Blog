---
date: 2022-10-08
author: Julian Krieger
---

# Serial.wasm

This CTF challenge focuses on a WebAssembly problem. Upon opening the website in the challenge's description, we are greeted with an input field in which to enter a serial key.

Entering a random string returns an error which complains about an incorrect length. Using this hint, we can see that the error changes when entering a string which is 24 characters long. However, the input field validation logic now complains about an incorrect format. 

After several trial and error attempts fail, now is the time to actually look into how the serial validation works. When inspecting the site with chrome's developer tools, we can see that there is an `onchange` handler listening for changes inside the input field. Upon closer inspection of the input handler and the prettified Javascript code it talks to, we can be pretty sure that `Serial.wasm` is written in `React` and `MUI`, a React component library. Further analysis is made hard by the fact that the original Javascript was obviously messed with, most likely in the build tool's production pipeline, by minifying and compressing the code. Variable names are shortened, and we can't see the original project layout. What we also can not find in our Javascript code are any references to the error message we can read when entering an incorrect serial.

We *can* see however, that a WebAssembly file is included in the website's source tab. When downloading and opening it, we are greeted with a `WAT` file instead of a WebAssembly file. This makes our future work a bit easier, but if the file was compiled `WASM` we could still reverse it. The file is 8400 lines long, so we could assume that the WASM file is obfuscated as well, in this case with indirection and dead end functions.

Contrary to compiled WebAssembly or assembler in general, function definitions can be read clear as day when the WebAssembly is still in text format. We can extract all function definitions with the `(\(func.*)` regex

```wasm
  (func $wasi_snapshot_preview1.fd_write (;0;) (import "wasi_snapshot_preview1" "fd_write") (param i32 i32 i32 i32) (result i32))
(func $env.emscripten_memcpy_big (;1;) (import "env" "emscripten_memcpy_big") (param i32 i32 i32) (result i32))
(func $env.setTempRet0 (;2;) (import "env" "setTempRet0") (param i32))
(func $__wasm_call_ctors (;3;) (export "__wasm_call_ctors")
(func $validate (;19;) (export "validate") (param $var0 i32) (result i32)
(func $__stdio_exit (;34;) (export "__stdio_exit")
(func $func35 (param $var0 i32)
(func $func36 (param $var0 i32) (result i32)
(func $func37 (param $var0 i32) (result i32)
(func $__errno_location (;38;) (export "__errno_location") (result i32)
(func $func39 (param $var0 f64) (param $var1 i32) (result f64)
(func $func40 (param $var0 i32) (param $var1 i32) (param $var2 i32) (result i32)
(func $func41 (param $var0 i32) (param $var1 i32) (param $var2 i32) (result i32)
(func $func42 (param $var0 i32) (param $var1 i32) (param $var2 i32) (param $var3 i32) (param $var4 i32) (result i32)
(func $func43 (param $var0 i32) (param $var1 i32) (param $var2 i32) (param $var3 i32) (param $var4 i32) (param $var5 i32) (param $var6 i32) (result i32)
(func $func44 (param $var0 i32) (param $var1 i32) (param $var2 i32)
(func $func45 (param $var0 i32) (result i32)
(func $func46 (param $var0 i32) (param $var1 i32) (param $var2 i32) (param $var3 i32)
(func $func47 (param $var0 i64) (param $var1 i32) (param $var2 i32) (result i32)
(func $func48 (param $var0 i64) (param $var1 i32) (result i32)
(func $func49 (param $var0 i64) (param $var1 i32) (result i32)
(func $func50 (param $var0 i32) (param $var1 i32) (param $var2 i32) (param $var3 i32) (param $var4 i32)
(func $func51 (param $var0 i32) (param $var1 i32) (param $var2 i32) (result i32)
(func $func52 (param $var0 i32) (param $var1 f64) (param $var2 i32) (param $var3 i32) (param $var4 i32) (param $var5 i32) (result i32)
(func $func53 (param $var0 i32) (param $var1 i32)
(func $func54 (param $var0 f64) (result i64)
(func $func55 (param $var0 i32) (result i32)
(func $func56 (result i32)
(func $func57 (result i32)
(func $func58 (result i32)
(func $func59
(func $func60 (param $var0 i32) (param $var1 i32) (param $var2 i32) (result i32)
(func $func61 (param $var0 i32) (param $var1 i32) (result i32)
(func $func62 (param $var0 i32) (param $var1 i64) (param $var2 i64) (param $var3 i32)
(func $func63 (param $var0 i32) (param $var1 i64) (param $var2 i64) (param $var3 i32)
(func $func64 (param $var0 i64) (param $var1 i64) (result f64)
(func $stackSave (;65;) (export "stackSave") (result i32)
(func $stackRestore (;66;) (export "stackRestore") (param $var0 i32)
(func $stackAlloc (;67;) (export "stackAlloc") (param $var0 i32) (result i32)
(func $emscripten_stack_init (;68;) (export "emscripten_stack_init")
(func $emscripten_stack_get_free (;69;) (export "emscripten_stack_get_free") (result i32)
(func $emscripten_stack_get_base (;70;) (export "emscripten_stack_get_base") (result i32)
(func $emscripten_stack_get_end (;71;) (export "emscripten_stack_get_end") (result i32)
(func $func72 (param $var0 i32) (param $var1 i32) (param $var2 i64) (param $var3 i32) (result i64)
(func $dynCall_jiji (;73;) (export "dynCall_jiji") (param $var0 i32) (param $var1 i32) (param $var2 i32) (param $var3 i32) (param $var4 i32) (result i32)
```

Let's have a look at all function definitions with a name to get more information about what we are looking at.

```wasm
(func $wasi_snapshot_preview1.fd_write (;0;) (import "wasi_snapshot_preview1" "fd_write") (param i32 i32 i32 i32) (result i32))
(func $env.emscripten_memcpy_big (;1;) (import "env" "emscripten_memcpy_big") (param i32 i32 i32) (result i32))
(func $env.setTempRet0 (;2;) (import "env" "setTempRet0") (param i32))
(func $__wasm_call_ctors (;3;) (export "__wasm_call_ctors")
(func $validate (;19;) (export "validate") (param $var0 i32) (result i32)
(func $__stdio_exit (;34;) (export "__stdio_exit")
(func $__errno_location (;38;) (export "__errno_location") (result i32)
(func $stackSave (;65;) (export "stackSave") (result i32)
(func $stackRestore (;66;) (export "stackRestore") (param $var0 i32)
(func $stackAlloc (;67;) (export "stackAlloc") (param $var0 i32) (result i32)
(func $emscripten_stack_init (;68;) (export "emscripten_stack_init")
(func $emscripten_stack_get_free (;69;) (export "emscripten_stack_get_free") (result i32)
(func $emscripten_stack_get_base (;70;) (export "emscripten_stack_get_base") (result i32)
(func $emscripten_stack_get_end (;71;) (export "emscripten_stack_get_end") (result i32)
(func $dynCall_jiji (;73;) (export "dynCall_jiji") (param $var0 i32) 
```

The first interesting things that spring to mind are the `emscripten_` strings which prefix some functions. [Emscripten](https://emscripten.org/docs/porting/emscripten-runtime-environment.html) is a Binaryen wrapper that supplies a runtime environment for C/C++ code in the browser. To accomplish this, they ship a limited standard library with functions that are needed for the WebAssembly stack machine to work. The STL includes (among other things) a file system abstraction layer that connects C's synchronous file system API's with a virtual file system, so they can work with the browser's asynchronous fs access api. Traces of this can be seen all over our target binary: we can see that for the WASM code to work, we (or in this case the Serial.wasm website) needs to supply `memcpy`, `wasi_snapshot_preview1` and `env.setTempRet0`. 

The first real hint comes in the exported functions: the WASM file exports a `validate` function which takes our string as a parameter and returns a number. 

To further investigate, we would need to take a good look at the `validate` function and trace the execution path of the functions it itself calls. Since debugging WebAssembly directly is a miserable experience, we need to look for a better way.

Luckily for us, better ways exist. [WABT](https://github.com/WebAssembly/wabt) is a toolkit that ships binaries for working with WebAssembly files. We can use either `wasm-decompile` or `wasm2c` to generate C files that are far easier to read. 

Looking into the generated C file and scrolling through its contents, we can see large arrays filled with data strings. These are most likely ASCII characters. Concatenating the byte strings yields the following result:

```
5741534dea5dc17087b39b32d506508b5052fc920befdaaaa264afa8264464584c975f6056b3cbf9ce107a188bdf4e4916236f4be07efd379e5f85ae22ca21e9f614a15ea6de0a94a43c4f46ad3f3bc8145b70dbb4321c628507f0eedf7931b935ca8807208e7c4b873be593e525b44922f1757f0aa43ab2df6972dddd0729c5353e00e401c792942855a02f20920b24dc8dc0b94977e4af5237853b9860f37d528f44ae86b7e37d60b278484f7438cd36c4ccf7c77fe57ce87ea30f4942655fd6be972a925983bab867d597fd3a1c25adb71b97d04440e87a43e899a1f2603c2437acfaf0444da8786bd2edabb6a4fad12f4e8541b743f3449cc60a98094d5142d2c90f61dd39befd55d2155d47151f30cf03ce4a2315fce387e419e4962c761b827add4f8368e0efed04d97d543a18faa2ec09746bc25dd2a653b914da99fda06d40b89f62265117a87b12fd9c451f1127bbf43911c49cc0041fa02c8eabda68bb3093da3fd71fd1b6254aaf7b1ce3180cfa67aaf59ea8f5ef077beb2e6dda93070c78bfdb5a88ab68de69d34d7d3a6c07278780471753ca86c5574485574ebebe7d2ba5bdee204cf4737fac6c4892ccaaaeb07ef3de55fd6bd8404aa3fec746cebf25dda715454375c310d69bed3b0a0b5bcbf35a275137fa09aebb08c110eaee45814bf050c4937a871eba2e9cb679123e6ad16281c8257a13e1f0b0335505b0d2f3431aace4b1a78081d86cc372ac522600c4a85f080adbab030638b3d17413b461668cdbfe84a867eab0c79d7d3101cf671222e3c030d400c7c24086bc9b899026d2c2d7c92e2da825ac37bfeed12ca9b96fd40c8abe9f331abaeb335d48cb04b14c541848949f0a3251fea9958a48769b37f7a2a963741c5b1e8607a3d4cf8501cd2f1a1eeadfa330ecbca81ae901e7f654c2f027d8a2a96043a9771f388cee8da6b06bd6d3c932acbde5b0e10a1001d54602e0f63a8210eaae7ecc067b0618e7486b3142835f3617125c5a20c49749b3fb3544e4717d4de0761f34b10ee95c4ad916f32fb00d099cd9b6515a73a4729ded2a13275a2e670804a0b1adefe6f5b00c74b93479296c34965e9a98d17156e3b7f9b2ca3b05cca28342496352733fb9a1f4cda4f5ac631de352ea239f392aa704faace794552a46f78299b11c401932d42328ff4ff9c378b567844efc75e3460f86f475cb38fdacb92a12234993bfa3bd4bb52d49e1e1c9cd336aa1e185cc9657ef4867b04dcf3f99b5ffebf56c035eede7af14c5ca594dd58c34bdd57d709aa3deb278aadf4bdfe9174172b6888498fe67397b4955ff03a4eff6f46cdbce5480a8504b379c69fabdeabc8bea7caa26af75c5ebaaaee4a9fb558d29d0018e68368b03b51fc47f50fae4c27fc0fcc7fa232df93d98ba584202d68702c8518edddd9d9400c32d924044695ce220b8d31d3a4fa584f0611e26a06811ee69d801d7e2b155ee5f2a093c9e64ec02377c1cd2093efad21308346106d865b953e24cead26ac16d1bfdfcf3e7257d078c9656e952c62685b50cb2fd14d8dbfeb9f6f5f1e8b5d84753c190126a568bc796772c4238257069b4870233c47681dc0a2189a2c50e13f0c71706ebc4258c77711c5302381f3323c7c242f021c23f073dcaf9fc7a65c52e2dac4eaece51400a0275202adc886887c1b605e83368c15cf5204986fa9b11a9fd0475d9c075d5f1a978e81ca9b5f3b8c40e8f90b2ec106439977c0eba7151a847253c700f0d8dffe4515c19d6d156a5718599a5ade1773b6dcf94fb12d9985e102095824eda4dbad5f6d69423d21d50b111887037276e58e4297d1bdee979e08f1b245b39b3a9c46bc22c6092c27f5f6cf5e358f9c67cf07243643940de17085fad868e7300000000000000883da899d415c4ef943f3810b6f0686699879f4ba1c6245dd9a804609b6323c2d937fccd79f1306da37681104dbc2b4353527b002d2b20202030583078002d30582b30582030582d30782b3078203078006e616e00696e66004e414e00494e46002e00286e756c6c29004552523a20496e76616c6964207375666669780a004552523a20496e76616c696420666f726d61740a0025730a004552523a20496e76616c696420696e70757420737472696e67206c656e6774680a004552523a204d697373696e6720696e70757420737472696e670a004552523a2044656372797074206661696c65640a004552523a20496e76616c6964206b65792835290a004552523a20496e76616c6964206b6579202834290a004552523a20496e76616c6964206b6579202833290a004552523a20496e76616c6964206b6579202832290a004552523a20496e76616c6964206b6579202831290a19000a00191919000000000500000000000009000000000b00000000000000001900110a191919030a07000100090b18000009060b00000b0006190000001919190e000000000000000019000a0d191919000d00000200090e00000009000e00000e0c13000000001300000000090c00000000000c00000c100f000000040f0000000009100000000000100000101211000000001100000000091200000000001200001200001a0000001a1a1a1a0000001a1a1a00000000000009141700000000170000000009140000000000140000141615000000001500000000091600000000001600001600003031323334353637383941424344454605010200000003000000380d0000000401ffffffff0a900c
```

Decoding *that* with any hexadecimal ASCII to text tool delivers output containing a bunch of unreadable trash and some strings. We can find those with the `strings` utility.

```
WASM
+CSR{-+   
0X0x-0X+0X 0X-0x+0x
0xnaninfNANINF.(null)
ERR: Invalid suffix
ERR: Invalid format
ERR: Invalid input string length
ERR: Missing input string
ERR: Decrypt failed
ERR: Invalid key (5)
ERR: Invalid key (4)
ERR: Invalid key (3)
ERR: Invalid key (2)
ERR: Invalid key (1)
0123456789ABCDEF
```

Aha. There are a couple of interesting things to be found here that make solving the challenge an absolute breeze. First off, we can observe that the error messages we missed in the website's Javascript sources can all be found here. From them, we can conclude a couple of things:

- The serial key has a suffix
- The serial key as a valid format 
- The serial key is made up of 5 parts

The last part is a bit iffy: We know that our string needs to fit a certain format and has 5 parts. However, it's 24 characters long which is not neatly divisible by 5. If we rethink a bit and take a look at what is usually considered a "serial key", we can assume that maybe our serial key's parts are separated by some kind of delimiter. We can confirm our assumption by taking a deeper look at our decompiled WASM file: The validate function leads to randomly named subfunctions, which each test a different part of our input string. The last function is pretty easy to reverse: it tests the last 4 characters of our input string for characters in our data array: They need to match the string "WASM", which also exists in our hex dump above!

If we combine that information with our assumption about the delimiter and the fact that generally delimited serial keys are separated with the `-` character, we can assume that perhaps our serial key needs to match the following format:

```
0000-0000-0000-0000-WASM
```

Entering that string into the browser's input field (which call the validate function), we can see that the error changes! It now reports `Invalid key (1)`, indicating that the format is correct. This leads us to our next problem: The first 4 characters of the key are incorrect.

Since we want to avoid reversing the validation subfunctions for each of our serial key's parts, we can now think about bruteforcing the serial key. Brute forcing an entire 16 character key is impossible, but bruteforcing 4 different 4 character packages should be pretty fast, depending on the character set. To make things easier, we assume for a start that the serial key is made up out of upper case letters and numbers, like most serial keys seem to be. 

Directly testing our input field with a browser automation script framework like puppeteer or playwright would be way to slow. What we can do, is inspecting the place where the validate function is imported in our client Javascript in the browser, place a breakpoint and then call the validate function directly. 

We can write Javascript code that does the brute forcing part:

```js
function doCheck(wasmRuntime) {

  const alpha = 'ABCDEFGHIJKLMOPQRSTUVWXYZ0123456789';
  let serial = [
    "0000",
    "0000",
    "0000",
    "0000",
    "WASM"
  ]

  function* permutator(length = 4, prev = "") {
      if (length <= 0) {
        yield prev;
        return;
      }
      for (const char of [...alpha])
        yield* permutator(length - 1, prev + char);
    }

  for(int block = 0; i < 4; i ++) {

    const it = permutator();
    let result = it.next();
      while (!result.done) {
        result = it.next();


        const currentBlocks = [...serial];
        currentBlocks[block] = result.value;
        const currentString = currentBlocks.join("-");
        wasmRuntime.validate(currentString); //0 or 1
      
      
        const error = wasmRuntime.stdout;
        const errStr = `ERR: Invalid key (${block + 1})`;
        if (error !== errStr) {
          console.log(error);
          serial = currentString
        }
    }
  }

  return serial
};
```

Waiting for the debugger to hit our breakpoint when entering an input string, we can copy the WASM runtime instance into the browser console and call the validate function directly. The validate function returns a 1 for an errornous serial key and a 0 for a valid key. Errors are logged into stdout. With our `doCheck` function, we can now check each block, one after another.

This yields a lot of serial keys. Upon entering any 1 of our choosing, we get the key and complete the challenge!

Turns out, this challenge could've been solved even better: Take a look at our string dump again. Notice something at the very bottom? If you think you got it, open the solution below.

<details>
  <summary>Solution</summary>
  <p>0123456789ABCDEF looks an awful lot like a test string or a regex to test our serial format, doesn't it? We could've used that for our brute forcing algorithm to make things even faster!</p>
</details>