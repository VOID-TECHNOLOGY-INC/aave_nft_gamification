以下は**Foundryテスト雛形**と、前回の仕様に沿った\*\*オラクルのEIP-712スキーマ実装（最小版）\*\*です。
そのままコピペで動かせるよう、`foundry.toml` からテストまで一式を用意しています。

---

# プロジェクト構成（雛形）

```
nftlend-oracle/
├─ foundry.toml
├─ remappings.txt
├─ lib/
│  └─ openzeppelin-contracts/        # forge install OpenZeppelin後に生成
├─ src/
│  ├─ interfaces/
│  │  └─ IValuationOracle.sol
│  └─ ValuationOracle.sol
└─ test/
   └─ ValuationOracle.t.sol
```

---

## foundry.toml

```toml
[profile.default]
src = 'src'
out = 'out'
libs = ['lib']
solc_version = '0.8.24'
optimizer = true
optimizer_runs = 200
evm_version = 'paris'
```

---

## remappings.txt

```
@openzeppelin/=lib/openzeppelin-contracts/
```

> 依存の取得：
>
> ```bash
> forge init nftlend-oracle
> cd nftlend-oracle
> forge install OpenZeppelin/openzeppelin-contracts --no-commit
> ```

---

## src/interfaces/IValuationOracle.sol

```solidity
// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.24;

/// @notice 価格・スコアは basis point / 1e8 USD で表現
interface IValuationOracle {
    struct Valuation {
        uint256 price1e8;      // USD 1e8 decimals
        uint16  confidenceBP;  // 0..10000
        uint16  liquidityBP;   // 0..10000
        uint16  volatilityBP;  // 0..10000
        uint16  washBP;        // 0..10000
        uint64  validUntil;    // unix
        uint64  nonce;         // replay防止
        uint16  circuitFlags;  // ビットフラグ（貸出停止等）
        bytes   sig;           // EIP-712署名
    }

    event ValuationPosted(
        address indexed signer,
        address indexed collection,
        uint256 indexed tokenId,
        uint256 price1e8,
        uint64  validUntil,
        uint64  nonce,
        uint16  confidenceBP,
        uint16  liquidityBP,
        uint16  volatilityBP,
        uint16  washBP,
        uint16  circuitFlags
    );

    error InvalidSigner(address signer);
    error Expired();
    error NonceUsed(uint64 nonce);
    error BadSignature();

    function postValuation(address collection, uint256 tokenId, Valuation calldata v) external;

    function getLatest(address collection, uint256 tokenId)
        external
        view
        returns (uint256 price1e8, uint16 confidenceBP, uint16 liquidityBP, uint16 volatilityBP, uint16 washBP, uint64 validUntil, uint16 circuitFlags, address signer);

    function domainSeparator() external view returns (bytes32);
}
```

---

## src/ValuationOracle.sol（EIP-712実装・最小版）

```solidity
// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.24;

import {IValuationOracle} from "./interfaces/IValuationOracle.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/// @title ValuationOracle (EIP-712最小実装)
/// @notice 署名済みの評価値をオンチェーンに取り込み・検証する
contract ValuationOracle is IValuationOracle {
    using ECDSA for bytes32;

    /// @dev EIP-712 Domain
    bytes32 private immutable _DOMAIN_SEPARATOR;
    uint256 private immutable _CACHED_CHAIN_ID;

    string public constant NAME = "NFT Lend Valuation Oracle";
    string public constant VERSION = "1";

    /// @dev EIP-712 typehash
    /// 直列は型名・順序を固定（クライアントと厳密一致させる）
    bytes32 public constant VALUATION_TYPEHASH = keccak256(
        "ValuationPayload(address collection,uint256 tokenId,uint256 price1e8,uint16 confidenceBP,uint16 liquidityBP,uint16 volatilityBP,uint16 washBP,uint64 validUntil,uint64 nonce,uint16 circuitFlags)"
    );

    /// @dev 許可サイナー管理（マルチ可）
    mapping(address => bool) public isSigner;

    /// @dev 使い切りノンス
    mapping(address => mapping(uint64 => bool)) public usedNonce;

    /// @dev 最新値
    struct Stored {
        uint256 price1e8;
        uint16  confidenceBP;
        uint16  liquidityBP;
        uint16  volatilityBP;
        uint16  washBP;
        uint64  validUntil;
        uint16  circuitFlags;
        address signer;
    }
    mapping(address => mapping(uint256 => Stored)) public latest;

    constructor(address[] memory initialSigners) {
        _CACHED_CHAIN_ID = block.chainid;
        _DOMAIN_SEPARATOR = _buildDomainSeparator();

        for (uint256 i = 0; i < initialSigners.length; i++) {
            isSigner[initialSigners[i]] = true;
        }
    }

    // ========= EIP-712 ==========

    function _buildDomainSeparator() internal view returns (bytes32) {
        return keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes(NAME)),
                keccak256(bytes(VERSION)),
                block.chainid,
                address(this)
            )
        );
    }

    function domainSeparator() external view returns (bytes32) {
        // チェーンID変更時は再計算（L2再org等のレアケース対策）
        if (block.chainid == _CACHED_CHAIN_ID) {
            return _DOMAIN_SEPARATOR;
        }
        return _buildDomainSeparator();
    }

    function _hashTypedData(
        address collection,
        uint256 tokenId,
        IValuationOracle.Valuation calldata v
    ) internal view returns (bytes32) {
        bytes32 structHash = keccak256(
            abi.encode(
                VALUATION_TYPEHASH,
                collection,
                tokenId,
                v.price1e8,
                v.confidenceBP,
                v.liquidityBP,
                v.volatilityBP,
                v.washBP,
                v.validUntil,
                v.nonce,
                v.circuitFlags
            )
        );
        return keccak256(abi.encodePacked("\x19\x01", domainSeparator(), structHash));
    }

    // ========= Core ==========

    function setSigner(address signer, bool allowed) external {
        // 雛形なのでシンプルにオーナー制御等は省略。実運用ではOwnable/Timelockを推奨
        isSigner[signer] = allowed;
    }

    function postValuation(
        address collection,
        uint256 tokenId,
        IValuationOracle.Valuation calldata v
    ) external override {
        if (v.validUntil < block.timestamp) revert Expired();

        bytes32 digest = _hashTypedData(collection, tokenId, v);
        (address signer, ) = _recoverUnchecked(digest, v.sig);

        if (!isSigner[signer]) revert InvalidSigner(signer);
        if (usedNonce[signer][v.nonce]) revert NonceUsed(v.nonce);

        // 署名正当性の最終チェック
        if (signer != ECDSA.recover(digest, v.sig)) revert BadSignature();

        usedNonce[signer][v.nonce] = true;

        latest[collection][tokenId] = Stored({
            price1e8: v.price1e8,
            confidenceBP: v.confidenceBP,
            liquidityBP: v.liquidityBP,
            volatilityBP: v.volatilityBP,
            washBP: v.washBP,
            validUntil: v.validUntil,
            circuitFlags: v.circuitFlags,
            signer: signer
        });

        emit ValuationPosted(
            signer,
            collection,
            tokenId,
            v.price1e8,
            v.validUntil,
            v.nonce,
            v.confidenceBP,
            v.liquidityBP,
            v.volatilityBP,
            v.washBP,
            v.circuitFlags
        );
    }

    function getLatest(address collection, uint256 tokenId)
        external
        view
        override
        returns (
            uint256 price1e8,
            uint16 confidenceBP,
            uint16 liquidityBP,
            uint16 volatilityBP,
            uint16 washBP,
            uint64 validUntil,
            uint16 circuitFlags,
            address signer
        )
    {
        Stored memory s = latest[collection][tokenId];
        return (
            s.price1e8,
            s.confidenceBP,
            s.liquidityBP,
            s.volatilityBP,
            s.washBP,
            s.validUntil,
            s.circuitFlags,
            s.signer
        );
    }

    /// @dev ecrecoverの早期失敗検出を避けるシンプル実装
    function _recoverUnchecked(bytes32 digest, bytes memory sig) internal pure returns (address, bytes32) {
        return (ECDSA.recover(digest, sig), digest);
    }
}
```

---

## test/ValuationOracle.t.sol（Foundryテスト）

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/ValuationOracle.sol";
import "../src/interfaces/IValuationOracle.sol";

contract ValuationOracleTest is Test {
    ValuationOracle oracle;

    // テスト用サイナー秘密鍵（Foundryのvm.signで使用）
    uint256 signerPk = 0xA11CE;
    address   signer  = vm.addr(0xA11CE);

    address collection = address(0xBEEF);
    uint256 tokenId = 1234;

    function setUp() public {
        address;
        signers[0] = signer;
        oracle = new ValuationOracle(signers);
    }

    function test_PostValuation_EIP712_Success() public {
        IValuationOracle.Valuation memory v;

        v.price1e8     = 123_4500_0000; // 123.45 USD
        v.confidenceBP = 7200;
        v.liquidityBP  = 6000;
        v.volatilityBP = 3000;
        v.washBP       = 500;
        v.validUntil   = uint64(block.timestamp + 3600);
        v.nonce        = 42;
        v.circuitFlags = 0;

        // EIP-712ダイジェストをSolidity側で計算
        bytes32 digest = _digest(collection, tokenId, v);

        // 署名（テスト用：Foundryのプリミティブ）
        (uint8 vSig, bytes32 r, bytes32 s) = vm.sign(signerPk, digest);
        v.sig = abi.encodePacked(r, s, vSig);

        // 投稿
        oracle.postValuation(collection, tokenId, v);

        (
            uint256 price1e8,
            uint16  confidenceBP,
            uint16  liquidityBP,
            uint16  volatilityBP,
            uint16  washBP,
            uint64  validUntil,
            uint16  circuitFlags,
            address signerOut
        ) = oracle.getLatest(collection, tokenId);

        assertEq(price1e8, v.price1e8);
        assertEq(confidenceBP, v.confidenceBP);
        assertEq(liquidityBP, v.liquidityBP);
        assertEq(volatilityBP, v.volatilityBP);
        assertEq(washBP, v.washBP);
        assertEq(validUntil, v.validUntil);
        assertEq(circuitFlags, v.circuitFlags);
        assertEq(signerOut, signer);

        // 同一nonceは再利用不可
        vm.expectRevert(IValuationOracle.NonceUsed.selector);
        oracle.postValuation(collection, tokenId, v);
    }

    function test_RevertOnExpired() public {
        IValuationOracle.Valuation memory v;

        v.price1e8     = 1;
        v.confidenceBP = 1;
        v.liquidityBP  = 1;
        v.volatilityBP = 1;
        v.washBP       = 0;
        v.validUntil   = uint64(block.timestamp - 1); // 期限切れ
        v.nonce        = 1;
        v.circuitFlags = 0;

        bytes32 digest = _digest(collection, tokenId, v);
        (uint8 vSig, bytes32 r, bytes32 s) = vm.sign(signerPk, digest);
        v.sig = abi.encodePacked(r, s, vSig);

        vm.expectRevert(IValuationOracle.Expired.selector);
        oracle.postValuation(collection, tokenId, v);
    }

    function test_RevertOnInvalidSigner() public {
        // signerを無効化
        oracle.setSigner(signer, false);

        IValuationOracle.Valuation memory v;

        v.price1e8     = 1;
        v.confidenceBP = 1;
        v.liquidityBP  = 1;
        v.volatilityBP = 1;
        v.washBP       = 0;
        v.validUntil   = uint64(block.timestamp + 10);
        v.nonce        = 7;
        v.circuitFlags = 0;

        bytes32 digest = _digest(collection, tokenId, v);
        (uint8 vSig, bytes32 r, bytes32 s) = vm.sign(signerPk, digest);
        v.sig = abi.encodePacked(r, s, vSig);

        vm.expectRevert(abi.encodeWithSelector(IValuationOracle.InvalidSigner.selector, signer));
        oracle.postValuation(collection, tokenId, v);
    }

    // ===== Helpers =====

    function _digest(address _collection, uint256 _tokenId, IValuationOracle.Valuation memory v)
        internal
        view
        returns (bytes32)
    {
        // DomainSeparatorはコントラクトから取得
        bytes32 ds = oracle.domainSeparator();

        bytes32 typehash = oracle.VALUATION_TYPEHASH();
        bytes32 structHash = keccak256(
            abi.encode(
                typehash,
                _collection,
                _tokenId,
                v.price1e8,
                v.confidenceBP,
                v.liquidityBP,
                v.volatilityBP,
                v.washBP,
                v.validUntil,
                v.nonce,
                v.circuitFlags
            )
        );

        return keccak256(abi.encodePacked("\x19\x01", ds, structHash));
    }
}
```

---

# 使い方

```bash
forge test -vv
```

---

## 補足（実運用に向けた拡張ポイント）

* `setSigner` は `Ownable`/`AccessControl`/`Timelock` でガードする
* 複数提供者（AI/フロア系/バックアップ系）を受け取り、**外れ値除外＋min合成**を `postValuation` 内で実装
* `validUntil` 超過時の\*\*時間劣化（decay）\*\*ロジックを `getLatest` に追加
* 別途 `combineMinWithOutlierReject()` を用意し、中央値±X%外を無効化→min採用
* 監査向けにイベント・インデックス最適化、`reentrancy` ガード（現実装は外部送金無しで安全）

---

必要であれば、このオラクルに\*\*LoanManager（HF計算・LTV反映）\*\*をつないだ統合テスト雛形も出します。

