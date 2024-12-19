---
date: 2024-12-14
author: charlie74 (Constantin)
article: false
timeline: false
---

# FrontierMarketplace - Writeup

## Description

**Files Provided:**  
- Setup.sol — Setup smart contract
- FrontierMarketplace.sol — Smart contract of marketplace for NFTs
- FrontierNFT.sol - Smart contract for NFT handling

**Goal:**  
Get yourself more NFTs/Balance than you should actually have.

---

## Approach & Strategy

### Analysis
- **Tools Used:** VS Code, [Remix IDE](https://remix.ethereum.org)
- **Initial Thoughts/Plan:**  
  - First I skimmed the code of the three smart contract files and tried to understand the logic and interaction behind buying and refunding NFT tokens via FrontierMarketplace.sol and FrontierNFT.sol.
  - I developed a custom python program which uses the web3 library to interact with the Ethereum based blockchain and smart contracts.
  - Then I checked the blockchain via the given player account for any transactions, which led to nothing than the genesis block and no transactions.
  - I analyzed the smart contracts even further with special regards to the requirements. What was kind of suspicious are the three different approval cases in the public `transferFrom(address from, address to, uint256 tokenId)` function in FrontierNFT.sol which checks if one could transfer a NFT token of tokenId from A to B. This function was used by `refundNFT(uint256 tokenId)` in FrontierMarketplace.sol.
    ```solidity
    require(
         msg.sender == from || isApprovedForAll(from, msg.sender) || msg.sender == getApproved(tokenId),
            "FrontierNFT: transfer caller is not owner nor approved"
        );
    ```
  - Here you can see three different cases if someone (`msg.sender`) gets their transfer of existing NFT tokens approved:
    1. When they are the holder (`msg.sender == from`)
    2. When they have been previously approved for this transfer (look at `setApprovalForAll(address operator, bool approved)`, `isApprovedForAll(address owner, address operator)` for deeper understanding)
    3. When they are able to get approvement because they are the holder of the token (`msg.sender == getApproved(uint256 tokenId)`)
  - The last case has a logic mistake in it which can be exploited. 
  - Each account started with 20 ETH (`PLAYER_STARTING_BALANCE = 20 ether`) while one NFT token always costs 10 ETH (`NFT_VALUE = 10 ether`). So someone could only buy one NFT token (Because of Gas fees a transactions needs to be broadcasted, someone would always have slightly less than 10 ether to buy another one.).
  - However being an owner of one NFT token makes you eligible to run `approve(address to, uint256 tokenId)` which approves a transfer which can later be used by the third case of the `transferFrom()` function to transfer this NFT token.

---

## Exploitation Process

- With these information I set up a plan:
    1. Buy one NFT token of tokenId
    2. Approve to transfer this NTF token of tokenId to yourself (which itself would only result in a self transfer)
    3. Refund this NFT token of tokenId (which equals a transfer from yourself to the marketplace)
    4. Run the `transferFrom(address from, address to, uint256 tokenId)` which utilises the prior approval to transfer from the marketplace to yourself with the same NFT token of tokenId
    5. Now you have one NFT token with the same balance from the beginning (minus the transactions gas fees), so it seems like you got it for free
