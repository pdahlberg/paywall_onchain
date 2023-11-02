import * as anchor from "@coral-xyz/anchor"
import { Keypair, PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js"
import { 
  getMint,
  mintTo,
  createAssociatedTokenAccount, 
  TOKEN_PROGRAM_ID, 
  createMint,
  setAuthority, 
  AuthorityType,
  getAssociatedTokenAddress, 
  getAccount,
  createMintToInstruction,
  getOrCreateAssociatedTokenAccount,
} from "@solana/spl-token"
import { assert, expect } from 'chai'
import { Program } from "@coral-xyz/anchor"
import { PaywallOnchain } from "../target/types/paywall_onchain"
import { PriceState, initPrice, updatePrice } from "./price"
import { delay, initializeTestUsers, safeAirdrop } from "./util"
import { programAuthority, programAuthorityDevnet, userKeypair1 } from "./testKeypairs"

type KP = anchor.web3.Keypair

export const MULT: number = 1_000_000
export const RATE_MULT: number = 100_000_000_000

describe("paywall_onchain", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env())

  const program = anchor.workspace.PaywallOnchain as Program<PaywallOnchain>

  describe("price", () => {
    /*it("initializes price", async () => {
    
      let result = await initPrice(program)

      expect(result.price).to.equal(1000000)
    })*/

    it("updates price", async () => {
      console.log('programAuthority: ', programAuthorityDevnet.publicKey.toBase58())
      await safeAirdrop(programAuthorityDevnet.publicKey, program.provider.connection)
      delay(2000)

      let state = await initPrice(program, programAuthorityDevnet)

      await updatePrice(state, programAuthorityDevnet, 7)

      let result = await (await state.refresh()).price
      console.log('state.publicKey: ', state.publicKey.toBase58())
      state.log()
      expect(result).to.equal(7)
    })

    /*it("updates price", async () => {
      let state = await initPrice(program)

      await updatePrice(state, 5000000)

      let result = await (await state.refresh()).price
      expect(result).to.equal(5000000)
    })*/
  })

  describe("experimenting", () => {
    const provider = program.provider as anchor.AnchorProvider
    xit("mints some usdc", async () => {
      const USDC_MINT = new anchor.web3.PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
      const payer = (provider.wallet as anchor.Wallet).payer;
      assert.ok(payer.publicKey.toBase58() == provider.wallet.publicKey.toBase58())
      assert.ok(payer.publicKey.toBase58() == "87AT56xPtYs3yracfWKJ8trTpeahKQY2nTQVSMAsH3J5")
  
      //create associated token account
      let usdcTokenAccount = await getOrCreateAssociatedTokenAccount(
        provider.connection, //connection
        payer, //payer
        USDC_MINT, //mint
        payer.publicKey, //owner
      )
  
      //mint tokens
      const mintTokenTX = new anchor.web3.Transaction();
      mintTokenTX.add(createMintToInstruction(
        USDC_MINT,
        usdcTokenAccount.address,
        payer.publicKey,
        1000 * 10 ** 6, //1000 usdc tokens
      ));
      await provider.sendAndConfirm(mintTokenTX, [payer]);
    
      const newBalance = await provider.connection.getTokenAccountBalance(usdcTokenAccount.address)
      //console.log(newBalance);
      assert.equal(Number(newBalance.value.uiAmount), 1000)
    })

    xit("xp-1", async () => {
      const payer = (provider.wallet as anchor.Wallet).payer;
      await safeAirdrop(programAuthority.publicKey, provider.connection)
      await safeAirdrop(provider.wallet.publicKey, provider.connection)
      await safeAirdrop(userKeypair1.publicKey, provider.connection)
      delay(10000)
  
      let usdcMint = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v")
  
      //create associated token account
      let programUsdcTokenAccount = await getOrCreateAssociatedTokenAccount(
        provider.connection, //connection
        programAuthority, //payer
        usdcMint, //mint
        programAuthority.publicKey, //owner
      )

      const userAta = await getOrCreateAssociatedTokenAccount(
        provider.connection, //connection
        userKeypair1, //payer
        usdcMint, //mint
        userKeypair1.publicKey, //owner
      )

      //mint tokens to user
      await mintTo(
        provider.connection,
        userKeypair1,
        usdcMint,
        userAta.address,
        payer,
        1000 * 10 ** 6,
      )

      /*const mintTokenTX = new anchor.web3.Transaction();
      mintTokenTX.add(createMintToInstruction(
        usdcMint,
        usdcTokenAccount.address,
        userKeypair1.publicKey,
        1000 * 10 ** 6, //1000 usdc tokens
      ));
      await provider.sendAndConfirm(mintTokenTX, [userKeypair1]);*/


      let [vaultAuthority, vaultAuthBump] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault_authority")],
        program.programId
      )
    
      /*await setAuthority(
        provider.connection,
        programAuthority,
        usdcMint,
        programAuthority,
        AuthorityType.MintTokens,
        vaultAuthority
      )*/

      const [poolState, poolBump] = PublicKey.findProgramAddressSync(
        [usdcMint.toBuffer(), Buffer.from("state")],
        program.programId
      )
  
      const [vault, vaultBump] = PublicKey.findProgramAddressSync(
        [usdcMint.toBuffer(), vaultAuthority.toBuffer(), Buffer.from("vault")],
        program.programId
      )
  
      await program.methods
        .initPools()
        .accounts({
          poolState: poolState,
          tokenVault: vault,
          tokenMint: usdcMint,
          programAuthority: programAuthority.publicKey,
          vaultAuthority: vaultAuthority,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY
        })
        .signers([programAuthority])
        .rpc();

        const poolAcct = await program.account.poolState.fetch(poolState)
        expect(poolAcct.authority.toBase58() == programAuthority.publicKey.toBase58())
        expect(poolAcct.amount.toNumber() == 0)

        // const userAta = await getAssociatedTokenAddress(usdcMint, userKeypair1.publicKey)

        let priceState = await initPrice(program, programAuthority)
        await updatePrice(priceState, programAuthority, 200 * MULT)

        await program.methods.pay(new anchor.BN(200 * MULT))
          .accounts({
            pool: poolState,
            tokenVault: vault,
            user: userKeypair1.publicKey,
            userTokenAccount: userAta.address,
            priceState: priceState.getPubKey(),
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([userKeypair1])
          .rpc()
    
        let userTokenAcct = await getAccount(provider.connection, userAta.address)
        let stakeVaultAcct = await getAccount(provider.connection, vault)
        //assert(userTokenAcct.amount == initialUserBalance - BigInt(200*MULT))
        //assert(stakeVaultAcct.amount == initialVaultBalance + BigInt(200*MULT))
        
        let poolAcct2 = await program.account.poolState.fetch(poolState)
        expect(poolAcct2.amount.toNumber() == 200 * MULT)
      })
  })

})




