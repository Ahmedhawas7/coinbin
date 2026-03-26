// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title CoinBinRouter
 * @dev A highly optimized and secure batch sweeper contract for the Base Network.
 * It allows users to execute multiple token approvals, swaps (via 0x/Aerodrome), and burns
 * inside a single, gas-efficient, and reentrancy-protected transaction.
 */
contract CoinBinRouter is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    // Fee recipient for pro-tier or small tax (configurable)
    address public feeRecipient;
    uint256 public feeBps; // Up to 500 (5%)

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
        uint256 minAmountOut;   // Slippage protection: Minimum USDC/target token expected
    }

    constructor(address _initialFeeRecipient) Ownable(msg.sender) {
        require(_initialFeeRecipient != address(0), "Invalid fee recipient");
        feeRecipient = _initialFeeRecipient;
        feeBps = 0; // Starts 100% free
    }

    /**
     * @dev Main orchestration function. User must `approve` this router for all tokens before calling.
     * Contains ReentrancyGuard and SafeERC20 validations.
     */
    function batchSweep(SwapInstruction[] calldata instructions) external nonReentrant {
        uint256 usdcBalanceBefore = IERC20(USDC).balanceOf(address(this));

        for (uint256 i = 0; i < instructions.length; i++) {
            SwapInstruction memory inst = instructions[i];
            
            // Revert if amount is zero or token invalid
            if (inst.amountIn == 0 || inst.tokenIn == address(0)) continue;

            // 1. Pull tokens securely from user to this router
            IERC20(inst.tokenIn).safeTransferFrom(msg.sender, address(this), inst.amountIn);

            if (inst.isBurn) {
                // 2a. Burn the asset securely
                IERC20(inst.tokenIn).safeTransfer(BURN_ADDRESS, inst.amountIn);
                emit DustBurned(msg.sender, inst.tokenIn, inst.amountIn);
            } else {
                // 2b. Execute Swap (via generic payload)
                require(inst.targetContract != address(0), "Invalid target contract");

                // Safely approve the target contract (e.g., 0x Exchange) to spend the router's tokens
                // forceApprove handles non-standard ERC20s like USDT
                IERC20(inst.tokenIn).forceApprove(inst.targetContract, inst.amountIn);

                // Execute the swap call on the target aggregator router securely
                (bool success, ) = inst.targetContract.call(inst.targetPayload);
                require(success, "Swap Payload Failed");

                // Reset approval for safety
                IERC20(inst.tokenIn).forceApprove(inst.targetContract, 0);

                emit TokenSwept(msg.sender, inst.tokenIn, inst.amountIn, inst.targetContract);
            }
        }

        // 3. Collect Output (USDC usually accumulated in this router) and send to user
        uint256 usdcBalanceAfter = IERC20(USDC).balanceOf(address(this));
        
        // Calculate the actual USDC extracted during this specific sweep
        if (usdcBalanceAfter > usdcBalanceBefore) {
            uint256 usdcAccrued = usdcBalanceAfter - usdcBalanceBefore;

            // Optional slippage enforcement to prevent MEV/Sandwich attacks across the whole batch
            uint256 totalMinExpected = 0;
            for (uint256 i = 0; i < instructions.length; i++) {
                if (!instructions[i].isBurn) {
                    totalMinExpected += instructions[i].minAmountOut;
                }
            }
            require(usdcAccrued >= totalMinExpected, "Slippage tolerance exceeded");

            if (feeBps > 0 && feeRecipient != address(0)) {
                uint256 fee = (usdcAccrued * feeBps) / 10000;
                IERC20(USDC).safeTransfer(feeRecipient, fee);
                IERC20(USDC).safeTransfer(msg.sender, usdcAccrued - fee);
            } else {
                IERC20(USDC).safeTransfer(msg.sender, usdcAccrued);
            }
        }
    }

    // --- Admin Functions ---
    
    function setFee(uint256 _feeBps) external onlyOwner {
        require(_feeBps <= 500, "Max fee is 5%"); // 500 BIPS = 5%
        feeBps = _feeBps;
    }

    function setFeeRecipient(address _recipient) external onlyOwner {
        require(_recipient != address(0), "Invalid fee recipient");
        feeRecipient = _recipient;
    }

    // Rescue any tokens accidentally sent deeply to the contract
    function rescueTokens(address _token, uint256 _amount) external onlyOwner {
        IERC20(_token).safeTransfer(owner(), _amount);
    }
}
