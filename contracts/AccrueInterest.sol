// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.17;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract AccrueInterest {
    IERC20 public usdtToken;
    IERC20 public cvisionToken;

    uint256 public constant FOURTY_FIVE = 45 days;
    uint256 public constant ONE_HUNDRED_EIGHTY = 180 days;
    uint256 public constant INTEREST_45 = 18;
    uint256 public constant INTEREST_180 = 48;

    struct User {
        uint256 usdtBalance;
        uint256 timestampWithdraw;
        uint256 timestampDeposit;
        uint256 lockUpPeriod;
        bool boost;
    }
    // user => hash => user info
    mapping(address => mapping(bytes32 => User)) public userDeposits;
    mapping(address => bytes32[]) public userHashes;

    constructor(IERC20 _usdtToken, IERC20 _cvisionToken) {
        usdtToken = _usdtToken;
        cvisionToken = _cvisionToken;
    }

    /// A user deposits USDT and receives interests by choosing the lockup period
    /// @param _amount amount of USDT to be put into the contract
    /// @param _is45Days whether the user wants to lock up for 45 days
    /// @param _is180Days whether the user wants to lock up for 180 days
    function deposit(
        uint256 _amount,
        bool _is45Days,
        bool _is180Days
    ) external {
        require(_is45Days != _is180Days, "Must be one or the other");
        require(_is45Days || _is180Days, "Must choose a lockup period");

        bool _boost = _shouldBoost(msg.sender);
        uint256 _lockUpPeriod = _is45Days ? FOURTY_FIVE : ONE_HUNDRED_EIGHTY;
        bytes32 _hash = _getHash(
            msg.sender,
            _amount,
            _lockUpPeriod,
            block.timestamp
        );

        usdtToken.transferFrom(msg.sender, address(this), _amount);

        userDeposits[msg.sender][_hash] = User({
            usdtBalance: _amount,
            timestampDeposit: block.timestamp,
            timestampWithdraw: block.timestamp + _lockUpPeriod,
            lockUpPeriod: _lockUpPeriod,
            boost: _boost
        });
        userHashes[msg.sender].push(_hash);
    }

    /// Allows a user to withdraw their USDT and interests by using the hash of his deposit
    /// @param _hash hash of the user's deposit
    function withdraw(bytes32 _hash) external {
        User memory user = userDeposits[msg.sender][_hash];
        delete userDeposits[msg.sender][_hash];

        require(user.usdtBalance > 0, "No balance to withdraw");
        require(
            block.timestamp >= user.timestampWithdraw,
            "Cannot withdraw yet"
        );

        uint256 _boostInterest = user.boost ? 5 : 0;
        uint256 _typeOfInterest = (
            user.lockUpPeriod == FOURTY_FIVE ? INTEREST_45 : INTEREST_180
        ) + _boostInterest;
        uint256 _gainedInterest = (user.usdtBalance * _typeOfInterest) / 100;
        uint256 _totalToWithdraw = user.usdtBalance + _gainedInterest;

        usdtToken.transfer(msg.sender, _totalToWithdraw);
    }

    /// Given an address returns the list of hashes of the user's deposits
    /// @param _account address of the user
    function getUserDeposits(
        address _account
    ) public view returns (bytes32[] memory) {
        return userHashes[_account];
    }

    ////////////////////////////////////////////////////////////////////////////////////////
    ////////////////////////            INTERNAL METHODS        ////////////////////////////
    ////////////////////////////////////////////////////////////////////////////////////////
    /// Returns true whenever the user has a positive balance of Cryptovision tokens
    /// @param _user address of the user
    function _shouldBoost(address _user) internal view returns (bool) {
        return cvisionToken.balanceOf(_user) > 0;
    }

    /// Calculates the hash of a deposit
    /// @param _user address of the user
    /// @param _amount amount in USDT to deposit
    /// @param _lockUpPeriod amount of time to lock up the USDT
    /// @param _timestamp current time of the deposit being made
    function _getHash(
        address _user,
        uint256 _amount,
        uint256 _lockUpPeriod,
        uint256 _timestamp
    ) internal pure returns (bytes32) {
        return
            keccak256(
                abi.encodePacked(_user, _amount, _lockUpPeriod, _timestamp)
            );
    }
}
