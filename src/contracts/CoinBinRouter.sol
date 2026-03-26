// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title CoinBinRouter
 * @dev A highly optimized batch sweeper contract for the Base Network.
 * It allows users to execute multiple token approvals, swaps (via 0x/Aerodrome), and burns
 * inside a single, gas-efficient transaction.
 */
contract CoinBinRouter is Ownable {
    
    // Fee recipient for pro-tier or small tax (configurable)
    address public feeRecipient;
    uint256 public feeBps; // Set to 0 for free tier (0 - 10000)

    // Event logs for transparency
    event TokenSwept(address indexed user, address indexed tokenIn, uint256 amountIn, address target);
    event DustBurned(address indexed user, address indexed tokenIn, uint256 amountIn);

    // Common Base Contract Constants
    address constant BURN_ADDRESS = 0x000000000000000000000000000000000000dEaD;
    address constant USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;

    struct SwapInstruction {
        address tokenIn;
        uint256 amountIn;
        address targetContract; // e.g. 0x Aggregator, Aerodrome Router, or Uniswap
        bytes targetPayload;    // The actual encoded swap function call
        bool isBurn;            // If true, just transfer to BURN_ADDRESS
    }

    constructor(address _initialFeeRecipient) Ownable(msg.sender) {
        feeRecipient = _initialFeeRecipient;
        feeBps = 0; // Starts 100% free
    }

    /**
     * @dev Main orchestration function. User must `approve` this router for all tokens before calling.
     * OR they can batch permit if supported, but standard approval is standard.
     */
    function batchSweep(SwapInstruction[] calldata instructions) external {
        for (uint256 i = 0; i < instructions.length; i++) {
            SwapInstruction memory inst = instructions[i];
            
            // Revert if amount is zero to save gas
            if (inst.amountIn == 0) continue;

            // 1. Pull tokens from user to this router
            IERC20(inst.tokenIn).transferFrom(msg.sender, address(this), inst.amountIn);

            if (inst.isBurn) {
                // 2a. Burn the asset
                IERC20(inst.tokenIn).transfer(BURN_ADDRESS, inst.amountIn);
                emit DustBurned(msg.sender, inst.tokenIn, inst.amountIn);
            } else {
                // 2b. Execute Swap (via generic payload)
                
                // Approve the target contract (e.g., 0x Exchange) to spend the router's tokens
                if (IERC20(inst.tokenIn).allowance(address(this), inst.targetContract) < inst.amountIn) {
                    IERC20(inst.tokenIn).approve(inst.targetContract, type(uint256).max);
                }

                // Execute the swap call on the target aggregator router
                (bool success, ) = inst.targetContract.call(inst.targetPayload);
                require(success, "Swap Payload Failed");

                emit TokenSwept(msg.sender, inst.tokenIn, inst.amountIn, inst.targetContract);
            }
        }

        // 3. Collect Output (USDC/WETH usually accumulated in this router) and send to user
        // Send all USDC accrued in the router back to the user, minus any optional platform fee
        uint256 usdcBalance = IERC20(USDC).balanceOf(address(this));
        if (usdcBalance > 0) {
            if (feeBps > 0 && feeRecipient != address(0)) {
                uint256 fee = (usdcBalance * feeBps) / 10000;
                IERC20(USDC).transfer(feeRecipient, fee);
                IERC20(USDC).transfer(msg.sender, usdcBalance - fee);
            } else {
                IERC20(USDC).transfer(msg.sender, usdcBalance);
            }
        }
    }

    // --- Admin Functions ---
    
    function setFee(uint256 _feeBps) external onlyOwner {
        require(_feeBps <= 500, "Max fee is 5%");
        feeBps = _feeBps;
    }

    function setFeeRecipient(address _recipient) external onlyOwner {
        feeRecipient = _recipient;
    }

    // Rescue any tokens accidentally sent deeply to the contract
    function rescueTokens(address _token, uint256 _amount) external onlyOwner {
        IERC20(_token).transfer(owner(), _amount);
    }
}
