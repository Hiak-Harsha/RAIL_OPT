from __future__ import annotations
from typing import Dict, List, Any
from pydantic import BaseModel, Field
from ...simulator.railway.models import Train
from ...simulator.railway.graph import RailwayNetworkGraph


class DownstreamImpactNode(BaseModel):
    train_id: str
    train_name: str
    priority: int
    unmitigated_delay_min: float
    optimized_delay_min: float
    delay_saved_min: float
    impacted_by_train_id: str
    bottleneck_block_id: str


class DelayPropagationReport(BaseModel):
    primary_delayed_train_id: str
    primary_delay_min: float
    total_unmitigated_network_delay_min: float
    total_optimized_network_delay_min: float
    net_delay_savings_min: float
    delay_mitigation_efficiency_pct: float
    impacted_trains: List[DownstreamImpactNode] = Field(default_factory=list)
    estimation_method: str = "HEURISTIC_KNOCK_ON"  # Finding #13: explicitly non-authoritative


class DelayPropagationEstimator:
    """
    Estimates cascade propagation of primary delays to downstream following
    and opposing trains, comparing unmitigated knock-on delays vs optimized replanning.
    """

    def __init__(self, network: RailwayNetworkGraph, min_headway_sec: float = 180.0):
        self.network = network
        self.min_headway_sec = min_headway_sec

    def compute_propagation(
        self,
        primary_train: Train,
        injected_delay_sec: float,
        other_trains: List[Train]
    ) -> DelayPropagationReport:
        impacted_nodes: List[DownstreamImpactNode] = []
        primary_delay_min = round(injected_delay_sec / 60.0, 1)
        
        total_unmitigated_sec = injected_delay_sec
        total_optimized_sec = injected_delay_sec  # Primary delay is fixed, downstream is mitigated

        # Scan other trains sharing common route blocks
        primary_blocks = set(primary_train.route_block_ids)

        for train in other_trains:
            shared_blocks = [b for b in train.route_block_ids if b in primary_blocks]
            if not shared_blocks:
                continue

            # Shared bottleneck block
            bottleneck = shared_blocks[0]
            
            # Simple physics & headway knock-on propagation model
            # Downstream unmitigated delay decays slightly with spatial distance but accumulates at single lines
            is_single = (self.network.get_block(bottleneck).block_type.value == "SINGLE_LINE_SECTION") if self.network.get_block(bottleneck) else False
            knock_on_factor = 0.85 if is_single else 0.45

            unmitigated_train_delay_sec = injected_delay_sec * knock_on_factor
            
            # Optimized mitigation: holding at loop lines or prioritizing higher priority reduces knock-on significantly
            priority_diff = primary_train.priority.value - train.priority.value
            if priority_diff > 0:
                # Primary is higher priority: secondary train held safely with structured dwell
                optimized_train_delay_sec = unmitigated_train_delay_sec * 0.35
            else:
                # Secondary is higher priority: secondary given precedence first, primary waits
                optimized_train_delay_sec = unmitigated_train_delay_sec * 0.15

            unmit_min = round(unmitigated_train_delay_sec / 60.0, 1)
            opt_min = round(optimized_train_delay_sec / 60.0, 1)
            saved_min = round(unmit_min - opt_min, 1)

            total_unmitigated_sec += unmitigated_train_delay_sec
            total_optimized_sec += optimized_train_delay_sec

            impacted_nodes.append(DownstreamImpactNode(
                train_id=train.train_id,
                train_name=train.train_name,
                priority=train.priority.value,
                unmitigated_delay_min=unmit_min,
                optimized_delay_min=opt_min,
                delay_saved_min=saved_min,
                impacted_by_train_id=primary_train.train_id,
                bottleneck_block_id=bottleneck
            ))

        total_unmit_min = round(total_unmitigated_sec / 60.0, 1)
        total_opt_min = round(total_optimized_sec / 60.0, 1)
        net_savings = round(total_unmit_min - total_opt_min, 1)
        efficiency = round((net_savings / max(1.0, total_unmit_min)) * 100.0, 1)

        return DelayPropagationReport(
            primary_delayed_train_id=primary_train.train_id,
            primary_delay_min=primary_delay_min,
            total_unmitigated_network_delay_min=total_unmit_min,
            total_optimized_network_delay_min=total_opt_min,
            net_delay_savings_min=net_savings,
            delay_mitigation_efficiency_pct=efficiency,
            impacted_trains=impacted_nodes
        )
