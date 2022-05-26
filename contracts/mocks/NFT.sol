// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract MyNFT is ERC721 {
    using Counters for Counters.Counter;
    Counters.Counter private _currentTokenId;

    constructor() ERC721("MyNFT", "MNFT") {}

    function mint() external {
        _safeMint(msg.sender, _currentTokenId.current());
        _currentTokenId.increment();
    }
}
