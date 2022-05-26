// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.9;

import "redstone-evm-connector/lib/contracts/message-based/PriceAware.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

error InvalidCaller();
error InvalidPrice();
error InvalidValue();
error InactiveOrder();

contract StablePriceNFTMarketplace is PriceAware, Ownable {
    enum OrderStatus {
        ACTIVE,
        CANCELED,
        EXECUTED
    }

    struct Order {
        address nftAddress;
        uint96 tokenId;
        address seller;
        uint256 price;
        OrderStatus status;
    }

    Order[] private _s_orders;

    event SellOrderCreated(
        address nftAddress,
        uint96 tokenId,
        address seller,
        uint256 price
    );

    event SellOrderCanceled(
        address nftAddress,
        uint96 tokenId,
        address seller,
        uint256 price
    );

    event BuyOrderCreated(
        address nftAddress,
        uint96 tokenId,
        address buyer,
        uint256 price
    );

    modifier onlyEOA() {
        if (msg.sender != tx.origin) revert InvalidCaller();
        _;
    }

    function createSellOrder(
        address nftAddress,
        uint96 tokenId,
        uint256 price
    ) external onlyEOA {
        if (price == 0) revert InvalidPrice();

        _s_orders.push(
            Order(nftAddress, tokenId, msg.sender, price, OrderStatus.ACTIVE)
        );

        IERC721(nftAddress).transferFrom(msg.sender, address(this), tokenId);

        emit SellOrderCreated(nftAddress, tokenId, msg.sender, price);
    }

    function createBuyOrder(uint96 orderId) external payable onlyEOA {
        Order memory order = _s_orders[orderId];

        if (order.status != OrderStatus.ACTIVE) revert InactiveOrder();

        uint256 expectedEthAmount = _getPriceFromOrder(order);
        if (msg.value < expectedEthAmount) revert InvalidValue();

        _s_orders[orderId].status = OrderStatus.EXECUTED;

        IERC721(order.nftAddress).transferFrom(
            address(this),
            msg.sender,
            order.tokenId
        );

        // 5% fee for using marketplace
        uint256 amountAfterFees = (expectedEthAmount * 95) / 100;

        payable(order.seller).transfer(amountAfterFees);

        emit BuyOrderCreated(
            order.nftAddress,
            order.tokenId,
            msg.sender,
            order.price
        );
    }

    function cancelSellOrder(uint96 orderId) external {
        Order memory order = _s_orders[orderId];

        if (order.status != OrderStatus.ACTIVE) revert InactiveOrder();
        if (msg.sender != order.seller) revert InvalidCaller();

        _s_orders[orderId].status = OrderStatus.CANCELED;

        IERC721(order.nftAddress).transferFrom(
            address(this),
            msg.sender,
            order.tokenId
        );

        emit SellOrderCanceled(
            order.nftAddress,
            order.tokenId,
            msg.sender,
            order.price
        );
    }

    function withdrawAllFunds() external onlyOwner {
        payable(msg.sender).transfer(address(this).balance);
    }

    function getPrice(uint96 orderId) external view returns (uint256) {
        return _getPriceFromOrder(_s_orders[orderId]);
    }

    function isSignerAuthorized(address signer)
        public
        pure
        override
        returns (bool)
    {
        // Check if signer is authorized RedStone Signer
        return signer == 0x0C39486f770B26F5527BBBf942726537986Cd7eb;
    }

    function _getPriceFromOrder(Order memory order)
        internal
        view
        returns (uint256)
    {
        return (order.price * 10**8) / getPriceFromMsg(bytes32("ETH"));
    }
}
